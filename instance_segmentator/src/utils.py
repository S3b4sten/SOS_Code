import json
import numpy as np
import cv2
from PIL import Image

def get_masked_crop(image_np: np.ndarray, mask: np.ndarray, bbox: list) -> Image.Image:
    """
    Extrait l'image via la bounding box, mais détourée (fond noir/blanc ou transparent)
    selon le masque. Cela aide énormément le modèle de vision (OpenAI) 
    pour qu'il se concentre uniquement sur l'objet et pas sur le décor.
    
    Args:
        image_np: Img d'origine (H, W, 3) (RGB)
        mask: Masque binaire d'origine (H, W) valeurs 0 ou 1
        bbox: format [x1, y1, x2, y2]
        
    Returns:
        Pillow Image du crop
    """
    x1, y1, x2, y2 = map(int, bbox)
    
    # Sécurité sur les limites
    h, w = image_np.shape[:2]
    x1 = max(0, x1)
    y1 = max(0, y1)
    x2 = min(w, x2)
    y2 = min(h, y2)
    
    # Extraire le crop
    img_crop = image_np[y1:y2, x1:x2].copy()
    mask_crop = mask[y1:y2, x1:x2]
    
    # Créer une image RGBA (= transparent) ou RGB fond blanc. On opte pour fond transparent (RGBA)
    rgba_crop = np.zeros((img_crop.shape[0], img_crop.shape[1], 4), dtype=np.uint8)
    rgba_crop[:, :, :3] = img_crop
    rgba_crop[:, :, 3] = (mask_crop * 255).astype(np.uint8)
    
    # Convertir en Pillow
    return Image.fromarray(rgba_crop, 'RGBA')

def export_results_to_json(results_list: list, output_path: str = "results.json"):
    """
    Exporte la liste des prédictions formatée vers un fichier JSON.
    """
    class NpEncoder(json.JSONEncoder):
        def default(self, obj):
            if isinstance(obj, np.integer):
                return int(obj)
            if isinstance(obj, np.floating):
                return float(obj)
            if isinstance(obj, np.ndarray):
                return obj.tolist()
            return super(NpEncoder, self).default(obj)

    with open(output_path, 'w', encoding='utf-8') as f:
        json.dump(results_list, f, cls=NpEncoder, indent=4, ensure_ascii=False)
