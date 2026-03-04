import os
import pytest
import yaml

def test_config_exists_and_valid():
    config_path = "config.yaml"
    assert os.path.exists(config_path), "Le fichier config.yaml est introuvable."
    
    with open(config_path, "r", encoding="utf-8") as f:
        config = yaml.safe_load(f)
        
    assert "segmentation" in config
    assert "classification" in config
    assert "rendering" in config
    
def test_imports():
    # Smoke tests pour s'assurer que l'app ne crashe pas aux imports
    try:
        from src.pipeline import InferencePipeline
        from src.renderer import Renderer
        from src.api_client import ClassificationApiClient
        import app
    except ImportError as e:
        pytest.fail(f"Erreur d'import : {e}")

def test_api_client_no_key():
    # Simuler l'absence de clé
    os.environ.pop("OPENAI_API_KEY", None)
    from src.api_client import ClassificationApiClient
    client = ClassificationApiClient("config.yaml")
    assert client.client is None # Should be None if no key
    
def test_mask_processing():
    import numpy as np
    from src.utils import get_masked_crop
    
    # Mock img (100x100) RGB
    img = np.ones((100, 100, 3), dtype=np.uint8) * 255
    # Mock mask
    mask = np.zeros((100, 100), dtype=np.uint8)
    mask[20:80, 20:80] = 1
    
    bbox = [20, 20, 80, 80]
    
    crop = get_masked_crop(img, mask, bbox)
    
    assert crop.size == (60, 60)
    assert crop.mode == "RGBA"
