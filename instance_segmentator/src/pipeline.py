import os
import cv2
import yaml
import numpy as np
from PIL import Image
import torch
import ultralytics
from ultralytics import YOLO

# Monkey Patch pour forcer weights_only=False et fixer les crashs PyTorch 2.6+ avec Ultralytics 8.1
# L'erreur "Unsupported global:" boucle sur des dizaines de classes internes YOLO (Conv, Sequential, C2f...)
original_torch_load = torch.load

def custom_torch_load(*args, **kwargs):
    kwargs['weights_only'] = False
    return original_torch_load(*args, **kwargs)

torch.load = custom_torch_load

from .api_client import ClassificationApiClient
from .utils import get_masked_crop

class InferencePipeline:
    def __init__(self, config_path: str = "config.yaml"):
        # Load configuration
        with open(config_path, "r", encoding="utf-8") as f:
            self.config = yaml.safe_load(f)
            
        self.seg_config = self.config["segmentation"]
        
        # Initialize YOLO model
        print(f"Loading YOLO model: {self.seg_config['model_path']} in pipeline...")
        self.model = YOLO(self.seg_config["model_path"])
        
        # Initialize API Client only if we are using the generic/MVP mode
        self.is_custom_model = self.seg_config.get("is_custom_model", False)
        if not self.is_custom_model:
            self.classifier = ClassificationApiClient(config_path)
        else:
            self.classifier = None

    def process_image(self, image_np: np.ndarray) -> list:
        """
        Traite une image NumPy (RGB), extrait les masques via YOLO, et si en mode MVP, 
        appelle l'API OpenAI pour classifier chaque objet détecté.
        Retourne une liste de dictionnaires.
        """
        # YOLO inference (returns list of Results objects)
        results = self.model(
            image_np, 
            conf=self.seg_config["conf_threshold"],
            iou=self.seg_config["iou_threshold"],
            verbose=False
        )
        
        yolo_res = results[0]
        final_results = []
        
        if yolo_res.masks is None or yolo_res.boxes is None:
            return final_results # Nothing detected
            
        boxes = yolo_res.boxes.xyxy.cpu().numpy()
        scores = yolo_res.boxes.conf.cpu().numpy()
        class_ids = yolo_res.boxes.cls.cpu().numpy().astype(int)
        
        # Masks are (N, H, W). Resize them to original image size
        # Original size is (H, W), yolo masks might be smaller
        h_orig, w_orig = image_np.shape[:2]
        masks_data = yolo_res.masks.data.cpu().numpy()
        
        for i in range(len(boxes)):
            box = boxes[i]
            score = float(scores[i])
            cls_id = class_ids[i]
            
            # Resize mask back to original resolution if it isn't already
            # Ultralytics masks are shape (N, 160, 160) usually
            mask = cv2.resize(masks_data[i], (w_orig, h_orig), interpolation=cv2.INTER_LINEAR)
            mask_bin = (mask > 0.5).astype(np.uint8)
            
            # Area filter
            area = int(np.sum(mask_bin))
            if area < self.seg_config["min_area"]:
                continue
                
            # Mode Custom vs MVP Zero-Shot
            category = "unknown"
            if self.is_custom_model:
                # If model is fine-tuned, YOLO already knows the category
                category = self.model.names[cls_id]
            else:
                # MVP mode: Crop and send to OpenAI
                crop_pil = get_masked_crop(image_np, mask_bin, box)
                category = self.classifier.classify_crop(crop_pil)
                
            # Filter valid (ignore "autre" and "unknown" for final output if needed, or keep them with low opacity)
            final_results.append({
                "id": i,
                "category": category,
                "score": round(score, 3), # YOLO confidence, MVP classification does not have score by default from chat API
                "bbox": [int(x) for x in box],
                "mask_area": area,
                "mask_bin": mask_bin # Kept internally for rendering, will be removed before JSON export
            })
            
        return final_results
