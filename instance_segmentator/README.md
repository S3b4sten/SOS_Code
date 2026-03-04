# Assistant de Segmentation (Lego, Figurine, Voiture)

Une application complète (MVC/Pipeline IA) permettant de segmenter une image et de classifier ses objets sans entraînement lourd grâce à une combinaison **YOLOv8-seg** (détection / masque) + **OpenAI API (Vision)** (classification zero-shot).

## 🚀 Lancement Rapide

### Prérequis
- Python 3.11+
- Une clé API OpenAI (`OPENAI_API_KEY`)

```bash
# 1. Cloner ou se placer dans le dossier
cd instance_segmentator

# 2. Installer les dépendances
pip install -r requirements.txt

# 3. Définir sa clé API
# Sous Windows (Powershell) :
$env:OPENAI_API_KEY="sk-..."
# Sous Linux/Mac :
export OPENAI_API_KEY="sk-..."

# 4. Lancer l'application Web
streamlit run app.py
```

## 🧠 Architecture du MVP Zero-Shot
Le modèle MVP fonctionne en deux temps :
1. **YOLOv8n-seg** : Tourne instantanément sur CPU (modèle de ~6Mo). Il détecte "tout ce qu'il connait" (les 80 classes COCO, ex: personne, voiture, chaise, bouteille...).
2. **GPT-4o-mini (Vision)** : Pour *chaque* objet détecté, on crée une image recadrée (*crop*) détourée (fond transparent) grâce au masque YOLO. Ce crop est envoyé à l'API OpenAI qui doit choisir parmi une liste stricte de catégories définies dans `config.yaml` (Lego, Figurine, Voiture).

## 🎛️ Configuration (`config.yaml`)
Vous pouvez paramétrer le comportement de l'application via `config.yaml` :
- **Seuils YOLO** : `conf_threshold` pour ne garder que les objets certains.
- **Rendu Visuel** : `colors`, `alpha`, taille des textes.
- **Classes** : Si vous ajoutez un nouveau type de jouet, ajoutez-le dans `categories` de ce fichier.

---

## 🏗️ [Avancées] Mode "Vrai" (Fine-Tuning YOLOv8-seg)

Le mode MVP est puissant mais coûteux en requêtes API et plus lent que de l'inférence locale pure. Voici comment passer au "mode vrai" en entraînant votre propre modèle YOLO.

### 1. Collecte & Annotation
Pour entraîner un modèle de segmentation, il vous faut des images (100 à 500 images) de Lego, Figurines et Voitures.
- Outil gratuit : **Label Studio** ou **Roboflow**.
- Astuce de pro : Utilisez **Segment Anything (SAM)** de Meta dans ces outils pour que le masque se dessine tout seul au clic.

Format d'annotation visé : **YOLOv8 Segmentation format** (fichiers texte `ID_classe x1 y1 x2 y2 x3 y3...` représentant le contour normalisé).

### 2. Entraînement
Une fois le dataset téléchargé au format YOLO (un sous-dossier `train` et `val`, plus un `dataset.yaml`), lancez :

```bash
yolo task=segment mode=train data=dataset.yaml model=yolov8n-seg.pt epochs=100 imgsz=640
```

### 3. Intégration dans cette App
Une fois l'entraînement fini, vous obtiendrez un fichier `best.pt`.
1. Placez `best.pt` dans ce dossier.
2. Ouvrez `config.yaml`.
3. Changez `model_path: "best.pt"`
4. Passez `is_custom_model: true`.

L'application n'appellera plus l'API OpenAI et fera 100% du travail (détection + classification) instantanément en local !

## 🐳 Docker
Pour construire et lancer via Docker :
```bash
docker build -t instance-segmentator .
docker run -p 8501:8501 -e OPENAI_API_KEY="sk-..." instance-segmentator
```
