import os
import json
import faiss
import numpy as np
from nltk.tokenize import sent_tokenize
from transformers import BertTokenizer, BertModel
from flask import Flask, request, jsonify
from werkzeug.utils import secure_filename
from dotenv import load_dotenv
from flask_cors import CORS
import requests
import pandas as pd
import zipfile
import fitz
import logging

os.environ["KMP_DUPLICATE_LIB_OK"] = "TRUE"

load_dotenv()

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

api_key = os.getenv('GEMINI_API_KEY') or os.getenv('gemini_api_key')
GEMINI_URL = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent"

app = Flask(__name__)
CORS(app)

MAX_UPLOAD_SIZE = 50 * 1024 * 1024  # 50MB
app.config['MAX_CONTENT_LENGTH'] = MAX_UPLOAD_SIZE

DATA_FOLDER = os.getenv('RAG_DATA_DIR', 'data')
UPLOAD_FOLDER = os.getenv('RAG_UPLOAD_DIR', 'uploads')
os.makedirs(DATA_FOLDER, exist_ok=True)
os.makedirs(UPLOAD_FOLDER, exist_ok=True)
app.config['UPLOAD_FOLDER'] = UPLOAD_FOLDER
ALLOWED_EXTENSIONS = {'pdf', 'csv', 'xls', 'xlsx', 'zip', 'txt', 'java', 'cpp', 'py', 'js', 'html', 'css', 'xml', 'json', 'properties'}

# Cache BERT model at startup
logger.info("Loading BERT model...")
_tokenizer = BertTokenizer.from_pretrained('bert-base-uncased')
_model = BertModel.from_pretrained('bert-base-uncased')
_model.eval()
logger.info("BERT model loaded.")


def context_file(context_id, suffix):
    return os.path.join(DATA_FOLDER, f"{secure_filename(context_id)}_{suffix}")


def allowed_file(filename):
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS


def extract_text_from_pdf(file_path):
    text = ""
    try:
        with fitz.open(file_path) as pdf:
            for page in pdf:
                text += page.get_text()
    except Exception as e:
        logger.error(f"Error extracting PDF text: {e}")
    return text


def extract_text_from_csv(file_path):
    try:
        df = pd.read_csv(file_path)
        return df.to_string()
    except Exception as e:
        logger.error(f"Error reading CSV: {e}")
        return ""


def extract_text_from_excel(file_path):
    try:
        engine = 'xlrd' if file_path.endswith('.xls') else 'openpyxl'
        df = pd.read_excel(file_path, engine=engine)
        return df.to_string()
    except Exception as e:
        logger.error(f"Error reading Excel file: {e}")
        return ""


def extract_text_from_zip(file_path):
    text = ""
    extract_dir = os.path.join(UPLOAD_FOLDER, "extracted")
    os.makedirs(extract_dir, exist_ok=True)

    try:
        with zipfile.ZipFile(file_path, 'r') as zip_ref:
            total_size = sum(info.file_size for info in zip_ref.infolist())
            if total_size > MAX_UPLOAD_SIZE * 2:
                logger.warning("Zip contents too large, skipping")
                return ""
            zip_ref.extractall(extract_dir)
    except (zipfile.BadZipFile, Exception) as e:
        logger.error(f"Error extracting zip: {e}")
        return ""

    skip_extensions = ('.png', '.jpg', '.jpeg', '.gif', '.exe', '.bin', '.class', '.o')
    text_extensions = ('.txt', '.java', '.cpp', '.py', '.js', '.html', '.css', '.xml', '.json', '.properties')

    for file_name in os.listdir(extract_dir):
        full_path = os.path.join(extract_dir, file_name)
        if not os.path.isfile(full_path):
            continue
        if file_name.endswith(skip_extensions):
            continue

        if file_name.endswith(text_extensions):
            try:
                with open(full_path, 'r', encoding='utf-8') as f:
                    text += f.read() + "\n"
            except UnicodeDecodeError:
                continue
        elif file_name.endswith('.pdf'):
            text += extract_text_from_pdf(full_path)
        elif file_name.endswith('.csv'):
            text += extract_text_from_csv(full_path)
        elif file_name.endswith(('.xls', '.xlsx')):
            text += extract_text_from_excel(full_path)

    return text


def split_document(doc, chunk_size=5):
    if not doc:
        return []
    sentences = sent_tokenize(doc)
    return [' '.join(sentences[i:i + chunk_size]) for i in range(0, len(sentences), chunk_size)]


def generate_embeddings(chunks):
    import torch
    embeddings = []
    with torch.no_grad():
        for chunk in chunks:
            inputs = _tokenizer(chunk, return_tensors='pt', truncation=True, max_length=512, padding='max_length')
            outputs = _model(**inputs)
            embeddings.append(outputs.last_hidden_state.mean(dim=1).numpy())
    return embeddings


def save_to_faiss(context_id, embeddings, chunks):
    if not embeddings:
        return

    index_file = context_file(context_id, "index.faiss")
    chunks_file = context_file(context_id, "chunks.json")

    if os.path.exists(index_file):
        index = faiss.read_index(index_file)
    else:
        index = faiss.IndexFlatL2(embeddings[0].shape[1])

    index.add(np.vstack(embeddings))
    faiss.write_index(index, index_file)

    existing_chunks = []
    if os.path.exists(chunks_file):
        with open(chunks_file, "r") as file:
            existing_chunks = json.load(file)

    existing_chunks.extend(chunks)
    with open(chunks_file, "w") as file:
        json.dump(existing_chunks, file)


def get_context_from_faiss(context_id, query_embedding, k=5):
    index_file = context_file(context_id, "index.faiss")
    chunks_file = context_file(context_id, "chunks.json")

    if not os.path.exists(index_file) or not os.path.exists(chunks_file):
        return None, None

    index = faiss.read_index(index_file)
    distances, indices = index.search(query_embedding, k)

    with open(chunks_file, "r") as file:
        chunks = json.load(file)

    relevant_chunks = [chunks[i] for i in indices[0] if i < len(chunks)]
    return relevant_chunks, distances[0]


def embed_query(query):
    import torch
    with torch.no_grad():
        inputs = _tokenizer(query, return_tensors='pt', truncation=True, max_length=512, padding='max_length')
        outputs = _model(**inputs)
        return outputs.last_hidden_state.mean(dim=1).numpy()


def query_gemini(relevant_chunks, query):
    prompt = f"Context:\n{' '.join(relevant_chunks)}\n\nQuestion: {query}"
    headers = {"Content-Type": "application/json"}
    payload = {
        "contents": [
            {"parts": [{"text": prompt}]}
        ]
    }

    response = requests.post(f"{GEMINI_URL}?key={api_key}", headers=headers, json=payload)
    return response.json()


@app.route('/upload/<context_id>', methods=['POST'])
def upload_file(context_id):
    if 'file' not in request.files:
        return jsonify({'error': 'No file uploaded'}), 400

    file = request.files['file']
    if file and allowed_file(file.filename):
        filename = secure_filename(file.filename)
        file_path = os.path.join(app.config['UPLOAD_FOLDER'], filename)
        file.save(file_path)

        try:
            if filename.endswith('.pdf'):
                content = extract_text_from_pdf(file_path)
            elif filename.endswith('.csv'):
                content = extract_text_from_csv(file_path)
            elif filename.endswith(('.xls', '.xlsx')):
                content = extract_text_from_excel(file_path)
            elif filename.endswith('.zip'):
                content = extract_text_from_zip(file_path)
                if not content:
                    return jsonify({'error': 'No text extracted from the zip file'}), 400
            elif filename.endswith(('.txt', '.java', '.cpp', '.py', '.js', '.html', '.css', '.xml', '.json', '.properties')):
                with open(file_path, 'r', encoding='utf-8') as f:
                    content = f.read()
            else:
                return jsonify({'error': 'Unsupported file type'}), 400

            split_documents = split_document(content)
            embeddings = generate_embeddings(split_documents)
            save_to_faiss(context_id, embeddings, split_documents)

            return jsonify({'status': f'File uploaded and processed for context ID {context_id}'}), 200
        except Exception as e:
            logger.error(f"Error processing file: {e}")
            return jsonify({'error': 'Failed to process file'}), 500

    return jsonify({'error': 'Invalid file format'}), 400


@app.route('/context/<context_id>', methods=['POST'])
def add_context(context_id):
    request_data = request.get_json()
    if not request_data or 'context' not in request_data:
        return jsonify({'error': 'Context data is missing'}), 400

    try:
        split_documents = split_document(request_data['context'])
        embeddings = generate_embeddings(split_documents)
        save_to_faiss(context_id, embeddings, split_documents)
        return jsonify({'status': f'Context added successfully for context ID {context_id}'}), 200
    except Exception as e:
        logger.error(f"Error adding context: {e}")
        return jsonify({'error': 'Failed to process context'}), 500


@app.route('/query/<context_id>', methods=['POST'])
def get_response(context_id):
    request_data = request.get_json()
    if not request_data or 'query' not in request_data:
        return jsonify({'error': 'Query parameter is missing'}), 400

    query = request_data['query']
    query_embedding = embed_query(query)

    relevant_chunks, distances = get_context_from_faiss(context_id, query_embedding, k=5)
    if distances is not None and distances.size > 0 and np.max(distances) > 1.0:
        relevant_chunks, _ = get_context_from_faiss(context_id, query_embedding, k=10)

    if not relevant_chunks:
        return jsonify({'error': f'No context found for context ID {context_id}'}), 404

    response = query_gemini(relevant_chunks, query)
    return jsonify(response), 200


@app.route('/save/<context_type>/<context_id>', methods=['POST'])
def save_context(context_type, context_id):
    request_data = request.get_json()
    if not request_data or 'context' not in request_data:
        return jsonify({'error': 'Context data is missing'}), 400

    try:
        split_documents = split_document(request_data['context'])
        embeddings = generate_embeddings(split_documents)
        save_to_faiss(f"{context_type}_{context_id}", embeddings, split_documents)
        return jsonify({'status': f'Context added successfully for {context_type} ID {context_id}'}), 200
    except Exception as e:
        logger.error(f"Error saving context: {e}")
        return jsonify({'error': 'Failed to process context'}), 500


@app.route('/query/<context_type>/<context_id>', methods=['POST'])
def query_context(context_type, context_id):
    request_data = request.get_json()
    if not request_data or 'query' not in request_data:
        return jsonify({'error': 'Query parameter is missing'}), 400

    query = request_data['query']
    query_embedding = embed_query(query)

    relevant_chunks, distances = get_context_from_faiss(f"{context_type}_{context_id}", query_embedding, k=5)
    if distances is not None and len(distances) > 0 and max(distances) > 1.0:
        relevant_chunks, _ = get_context_from_faiss(f"{context_type}_{context_id}", query_embedding, k=10)

    if not relevant_chunks:
        return jsonify({'error': f'No context found for {context_type} ID {context_id}'}), 404

    response = query_gemini(relevant_chunks, query)
    return jsonify(response), 200


@app.route('/health', methods=['GET'])
def health():
    return jsonify({'status': 'ok'}), 200


if __name__ == '__main__':
    app.run(
        host=os.getenv('FLASK_HOST', '127.0.0.1'),
        port=int(os.getenv('PORT', '5000')),
        debug=os.getenv('FLASK_DEBUG') == '1'
    )
