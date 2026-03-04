import os
import json
import streamlit as st
import numpy as np
from PIL import Image
from dotenv import load_dotenv

# Charger les variables du fichier .env (ex. OPENAI_API_KEY)
load_dotenv()

# Setup du layout plein écran
st.set_page_config(page_title="Instance Segmentation & Classification", layout="wide")

from src.pipeline import InferencePipeline
from src.renderer import Renderer
from src.utils import export_results_to_json

@st.cache_resource
def load_models():
    """Charge les modèles (YOLO) une seule fois et les met en cache pour Streamlit."""
    return InferencePipeline("config.yaml")

@st.cache_resource
def load_renderer():
    """Charge le moteur de rendu."""
    return Renderer("config.yaml")

def main():
    st.title("🧩 Application de Segmentation & Classification (MVP Zero-Shot)")
    st.markdown("""
    Cette application détecte les objets puis les classe parmi: **Lego, Figurine, Voiture**.
    Le modèle YOLO local s'occupe de la segmentation. Si le mode MVP est activé, l'API d'OpenAI se charge de la classification fine.
    *Assurez-vous que votre clé d'API (OPENAI_API_KEY) est bien reconnue si vous êtes en mode MVP.*
    """)
    
    # Sidebar
    st.sidebar.header("Paramètres")
    alpha_mask = st.sidebar.slider("Opacité du Masque", 0.0, 1.0, 0.5, 0.05)
    draw_contours = st.sidebar.checkbox("Afficher Contours", value=True)
    draw_labels = st.sidebar.checkbox("Afficher Labels", value=True)
    
    # Check si API OpenAI est là
    api_key_status = bool(os.getenv("OPENAI_API_KEY"))
    if not api_key_status:
         st.sidebar.warning("⚠️ Variable `OPENAI_API_KEY` introuvable. La classification MVP risque d'échouer.")
    else:
         st.sidebar.success("✅ `OPENAI_API_KEY` détectée.")
    
    # Initialisation de notre logique
    pipeline = load_models()
    renderer = load_renderer()
    
    # File uploader
    uploaded_file = st.file_uploader("Choisissez une image...", type=["jpg", "jpeg", "png"])
    
    if uploaded_file is not None:
        # Affichage colonnes
        col1, col2 = st.columns(2)
        
        # Load image via PIL
        image = Image.open(uploaded_file).convert("RGB")
        image_np = np.array(image)
        
        with col1:
            st.header("Image Originale")
            st.image(image, use_column_width=True)
            run_btn = st.button("Lancer l'Inférence", type="primary")
            
        if run_btn:
            with st.spinner("Analyse de l'image en cours... (Cela peut prendre qq secondes en MVP avec l'API)"):
                # Inference
                results = pipeline.process_image(image_np)
                
                if not results:
                    st.warning("Aucun objet détecté dans l'image.")
                else:
                    st.success(f"{len(results)} objets détectés !")
                    
                    # Rendering
                    rendered_np = renderer.draw_overlays(
                        image_np, 
                        results, 
                        alpha=alpha_mask,
                        draw_contours=draw_contours,
                        draw_labels=draw_labels
                    )
                    
                    rendered_pil = Image.fromarray(rendered_np)
                    
                    with col2:
                        st.header("Résultat Annoté")
                        st.image(rendered_pil, use_column_width=True)
                        
                        # Création du JSON (sans les masques binaires pour l'export, c'est trop gros)
                        export_data = []
                        for item in results:
                            item_copy = item.copy()
                            if 'mask_bin' in item_copy:
                                del item_copy['mask_bin']
                            export_data.append(item_copy)
                            
                        # Boutons de téléchargement
                        import io
                        buffered = io.BytesIO()
                        rendered_pil.save(buffered, format="PNG")
                        img_byte = buffered.getvalue()
                        
                        st.download_button(
                            label="📥 Télécharger l'image annotée",
                            data=img_byte,
                            file_name="annotated_image.png",
                            mime="image/png",
                            key="dl_img_btn"
                        )
                        
                        json_str = json.dumps(export_data, default=lambda x: float(x) if isinstance(x, np.floating) else x, indent=2)
                        st.download_button(
                            label="📊 Télécharger les résultats JSON",
                            data=json_str,
                            file_name="results.json",
                            mime="application/json"
                        )

if __name__ == "__main__":
    main()
