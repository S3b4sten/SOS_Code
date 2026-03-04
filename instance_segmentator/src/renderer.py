import cv2
import numpy as np
import yaml

class Renderer:
    def __init__(self, config_path: str = "config.yaml"):
        with open(config_path, "r", encoding="utf-8") as f:
            self.config = yaml.safe_load(f)["rendering"]
            
        self.colors = self.config["colors"]
        self.text_cfg = self.config["text"]
        
    def _get_color(self, category: str) -> tuple:
        """Récupère la couleur BGR pour OpenCV (depuis le yaml en RGB)."""
        rgb = self.colors.get(category, self.colors["default"])
        return (rgb[2], rgb[1], rgb[0]) # RGB to BGR for cv2 drawing if using cv2 directly, but Streamlit expects RGB

    def draw_overlays(
        self, 
        image_np: np.ndarray, 
        results: list, 
        alpha: float = None,
        draw_contours: bool = True,
        draw_labels: bool = True
    ) -> np.ndarray:
        """
        Dessine les masques, contours et textes sur l'image.
        image_np: array RGB
        """
        canvas = image_np.copy()
        alpha = alpha if alpha is not None else self.config["alpha_mask"]
        
        # Pour les masques on passe par une couche séparée afin d'appliquer l'alpha
        overlay = canvas.copy()
        
        # 1. Dessiner tous les masques colorés
        for item in results:
            mask = item["mask_bin"]
            color_rgb = self.colors.get(item["category"], self.colors["default"])
            
            # Colorer les pixels où le masque = 1
            overlay[mask == 1] = color_rgb
            
        # Appliquer la transparence
        cv2.addWeighted(overlay, alpha, canvas, 1 - alpha, 0, canvas)
        
        # 2. Dessiner les contours et le texte par dessus (pas de transparence)
        for item in results:
            mask = item["mask_bin"]
            color_rgb = self.colors.get(item["category"], self.colors["default"])
            
            # Contours
            if draw_contours:
                # Need uint8 for findContours
                contours, _ = cv2.findContours(mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
                cv2.drawContours(canvas, contours, -1, color_rgb, self.config["contour_thickness"])
                
            # Labels
            if draw_labels:
                bbox = item["bbox"]
                x1, y1 = bbox[0], bbox[1]
                
                label = f"#{item['id']} {item['category']} ({item['score']:.2f})"
                
                # Propriétés police
                font = cv2.FONT_HERSHEY_SIMPLEX
                font_scale = self.text_cfg["scale"]
                font_thickness = self.text_cfg["thickness"]
                
                # Calcul taille texte pour le fond de l'étiquette
                (text_width, text_height), baseline = cv2.getTextSize(label, font, font_scale, font_thickness)
                
                # Ajuster y pour pas couper en haut
                text_y = max(y1, text_height + 5)
                
                # Rectangle noir de fond (RGB Streamlit)
                bg_color = self.text_cfg["bg_color"]
                text_color = self.text_cfg["color"]
                
                cv2.rectangle(
                    canvas, 
                    (x1, text_y - text_height - 5), 
                    (x1 + text_width, text_y + baseline - 5), 
                    bg_color, 
                    cv2.FILLED
                )
                
                # Texte blanc
                cv2.putText(
                    canvas, 
                    label, 
                    (x1, text_y - 5), 
                    font, 
                    font_scale, 
                    text_color, 
                    font_thickness, 
                    cv2.LINE_AA
                )
                
        return canvas
