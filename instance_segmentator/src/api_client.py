import os
import base64
from io import BytesIO
from PIL import Image
from openai import OpenAI
import yaml

class ClassificationApiClient:
    
    def __init__(self, config_path: str = "config.yaml"):
        # Load config
        with open(config_path, "r", encoding="utf-8") as f:
            self.config = yaml.safe_load(f)["classification"]
            
        # Initialize client (requires OPENAI_API_KEY environment variable)
        self.api_key = os.getenv("OPENAI_API_KEY")
        if not self.api_key:
            print("Warning: OPENAI_API_KEY not found in environment. Classification will fail if attempted.")
        if self.api_key:
            try:
                self.client = OpenAI(api_key=self.api_key)
            except TypeError:
                # Fallback for some httpx/openai version mismatches where proxies keyword fails
                import httpx
                http_client = httpx.Client()
                self.client = OpenAI(api_key=self.api_key, http_client=http_client)
        else:
            self.client = None
        
        # Prepare classification prompt
        self.prompt = self.config["prompt"].replace(
            "{categories}", ", ".join(self.config["categories"])
        )

    def _encode_image_to_base64(self, image_pil: Image.Image) -> str:
        buffered = BytesIO()
        # Convert to RGB just in case
        if image_pil.mode in ("RGBA", "P"):
            image_pil = image_pil.convert("RGB")
            
        # JPEG compression saves bandwidth/latency
        image_pil.save(buffered, format="JPEG", quality=85)
        return base64.b64encode(buffered.getvalue()).decode('utf-8')

    def classify_crop(self, crop_pil_image: Image.Image) -> str:
        """
        Envoie une image recadrée d'un objet (Pillow) à l'API OpenAI
        pour classification parmi les catégories autorisées.
        """
        if not self.client:
            # Try to fetch it again (in case it was set after Streamlit cached this object)
            self.api_key = os.getenv("OPENAI_API_KEY")
            if self.api_key:
                from openai import OpenAI
                try:
                    self.client = OpenAI(api_key=self.api_key)
                except TypeError:
                    import httpx
                    http_client = httpx.Client()
                    self.client = OpenAI(api_key=self.api_key, http_client=http_client)
            else:
                return "unknown"
            
        try:
            base64_image = self._encode_image_to_base64(crop_pil_image)
            
            response = self.client.chat.completions.create(
                model=self.config["model"],
                messages=[
                    {
                        "role": "user",
                        "content": [
                            {"type": "text", "text": self.prompt},
                            {
                                "type": "image_url",
                                "image_url": {
                                    "url": f"data:image/jpeg;base64,{base64_image}",
                                    "detail": "low"  # low detail is fine and cheaper for crops
                                }
                            }
                        ]
                    }
                ],
                max_tokens=10, # On s'attend à un seul mot
                temperature=0.0 # Deterministic
            )
            
            result = response.choices[0].message.content.strip().lower()
            
            # Nettoyage si le modèle répond de manière verbeuse
            for category in self.config["valid_categories"]:
                if category in result:
                    return category
                    
            if "autre" in result:
                 return "autre"
                    
            return "unknown"
            
        except Exception as e:
            print(f"Error during API classification: {e}")
            return "error"
