# ============================================
# CALORIE TRACKER SERVER (Python Flask + SQLite)
# Production-ready backend for local use and MyDevil.net deployment
# ============================================

import os
import json
import sqlite3
import hashlib
import secrets
from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS

DB_FILE = 'database.db'

app = Flask(__name__, static_folder='.')
CORS(app)  # Enable Cross-Origin Resource Sharing for API requests

# --- Database Initialization ---
def init_db():
    conn = sqlite3.connect(DB_FILE)
    c = conn.cursor()
    
    # Users table
    c.execute('''
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT UNIQUE NOT NULL,
            password_hash TEXT NOT NULL,
            salt TEXT NOT NULL,
            daily_goal INTEGER DEFAULT 2000,
            macro_goals TEXT DEFAULT '{"protein":150,"carbs":250,"fat":70}',
            api_key TEXT DEFAULT '',
            profile TEXT DEFAULT '{}',
            weight_history TEXT DEFAULT '[]',
            favorites TEXT DEFAULT '[]'
        )
    ''')
    
    # Meals table
    c.execute('''
        CREATE TABLE IF NOT EXISTS meals (
            id TEXT PRIMARY KEY,
            user_id INTEGER NOT NULL,
            meal_date TEXT NOT NULL,
            meal_time TEXT NOT NULL,
            meal_type TEXT NOT NULL,
            items TEXT NOT NULL, -- JSON string
            total TEXT NOT NULL, -- JSON string
            created_at INTEGER NOT NULL,
            FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
        )
    ''')
    
    # Dynamic schema upgrade: add profile, weight_history, favorites if they don't exist
    for col, col_def in [('profile', "TEXT DEFAULT '{}'"), ('weight_history', "TEXT DEFAULT '[]'"), ('favorites', "TEXT DEFAULT '[]'")]:
        try:
            c.execute(f"ALTER TABLE users ADD COLUMN {col} {col_def}")
        except sqlite3.OperationalError:
            pass # Column already exists
            
    conn.commit()
    conn.close()

# --- Password Hashing Helpers (PBKDF2 with unique salts) ---
def hash_password(password, salt=None):
    if not salt:
        salt = secrets.token_hex(16)
    pwd_hash = hashlib.pbkdf2_hmac(
        'sha256', 
        password.encode('utf-8'), 
        salt.encode('utf-8'), 
        100000  # 100k iterations
    ).hex()
    return pwd_hash, salt

# --- Helper to extract user credentials from Authorization header ---
def get_authenticated_user():
    auth_header = request.headers.get('Authorization', '')
    if not auth_header:
        return None
    try:
        user_id_str, username = auth_header.split(':')
        return int(user_id_str), username
    except ValueError:
        return None

# --- Routing for Static Files ---
@app.route('/')
def serve_index():
    return send_from_directory('.', 'index.html')

@app.route('/<path:path>')
def serve_static(path):
    # Prevent directory traversal vulnerability
    if '..' in path or path.startswith('/') or path == DB_FILE or path == 'server.py' or path == 'passenger_wsgi.py':
        return "403 Forbidden", 403
    return send_from_directory('.', path)

@app.after_request
def add_header(response):
    # Force the browser to bypass local cache for static files
    response.headers['Cache-Control'] = 'no-store, no-cache, must-revalidate, post-check=0, pre-check=0, max-age=0'
    response.headers['Pragma'] = 'no-cache'
    response.headers['Expires'] = '-1'
    return response

# --- API Endpoints ---

@app.route('/api/register', methods=['POST'])
def register():
    body = request.json or {}
    username = body.get('username', '').strip().lower()
    password = body.get('password', '').strip()

    if len(username) < 3 or len(password) < 4:
        return jsonify({'error': 'Nazwa użytkownika musi mieć min. 3 znaki, a hasło min. 4 znaki.'}), 400

    conn = sqlite3.connect(DB_FILE)
    c = conn.cursor()
    
    try:
        password_hash, salt = hash_password(password)
        c.execute(
            'INSERT INTO users (username, password_hash, salt) VALUES (?, ?, ?)',
            (username, password_hash, salt)
        )
        conn.commit()
        
        user_id = c.lastrowid
        return jsonify({
            'success': True,
            'user': {'id': user_id, 'username': username},
            'token': f"{user_id}:{username}"
        })
    except sqlite3.IntegrityError:
        return jsonify({'error': 'Użytkownik o takiej nazwie już istnieje.'}), 400
    finally:
        conn.close()

@app.route('/api/login', methods=['POST'])
def login():
    body = request.json or {}
    username = body.get('username', '').strip().lower()
    password = body.get('password', '').strip()

    conn = sqlite3.connect(DB_FILE)
    c = conn.cursor()
    c.execute('SELECT id, password_hash, salt FROM users WHERE username = ?', (username,))
    row = c.fetchone()
    conn.close()

    if not row:
        return jsonify({'error': 'Nieprawidłowa nazwa użytkownika lub hasło.'}), 400

    user_id, stored_hash, salt = row
    calc_hash, _ = hash_password(password, salt)

    if calc_hash == stored_hash:
        return jsonify({
            'success': True,
            'user': {'id': user_id, 'username': username},
            'token': f"{user_id}:{username}"
        })
    else:
        return jsonify({'error': 'Nieprawidłowa nazwa użytkownika lub hasło.'}), 400

@app.route('/api/user-data', methods=['GET'])
def get_user_data():
    auth = get_authenticated_user()
    if not auth:
        return jsonify({'error': 'Brak autoryzacji'}), 401
    user_id, _ = auth

    conn = sqlite3.connect(DB_FILE)
    c = conn.cursor()
    
    c.execute('SELECT daily_goal, macro_goals, api_key, profile, weight_history, favorites FROM users WHERE id = ?', (user_id,))
    row = c.fetchone()
    
    daily_goal, macro_goals_json, api_key, profile, weight_history, favorites = row if row else (2000, '{}', '', '{}', '[]', '[]')

    # Get meals
    c.execute('SELECT id, meal_date, meal_time, meal_type, items, total, created_at FROM meals WHERE user_id = ?', (user_id,))
    meals_rows = c.fetchall()
    conn.close()

    meals_by_date = {}
    for r in meals_rows:
        meal_id, meal_date, meal_time, meal_type, items_json, total_json, created_at = r
        if meal_date not in meals_by_date:
            meals_by_date[meal_date] = []
        
        meals_by_date[meal_date].append({
            'id': meal_id,
            'time': meal_time,
            'type': meal_type,
            'items': json.loads(items_json),
            'total': json.loads(total_json),
            'createdAt': created_at
        })

    return jsonify({
        'dailyGoal': daily_goal,
        'macroGoals': json.loads(macro_goals_json),
        'apiKey': api_key,
        'profile': json.loads(profile or '{}'),
        'weightHistory': json.loads(weight_history or '[]'),
        'favorites': json.loads(favorites or '[]'),
        'meals': meals_by_date
    })

@app.route('/api/sync-data', methods=['POST'])
def sync_data():
    auth = get_authenticated_user()
    if not auth:
        return jsonify({'error': 'Brak autoryzacji'}), 401
    user_id, _ = auth

    body = request.json or {}
    daily_goal = body.get('dailyGoal')
    macro_goals = body.get('macroGoals')
    api_key = body.get('apiKey')
    profile = body.get('profile')
    weight_history = body.get('weightHistory')
    favorites = body.get('favorites')
    meals_to_save = body.get('meals', [])

    conn = sqlite3.connect(DB_FILE)
    c = conn.cursor()

    try:
        if daily_goal is not None:
            c.execute('UPDATE users SET daily_goal = ? WHERE id = ?', (daily_goal, user_id))
        if macro_goals is not None:
            c.execute('UPDATE users SET macro_goals = ? WHERE id = ?', (json.dumps(macro_goals), user_id))
        if api_key is not None:
            c.execute('UPDATE users SET api_key = ? WHERE id = ?', (api_key, user_id))
        if profile is not None:
            c.execute('UPDATE users SET profile = ? WHERE id = ?', (json.dumps(profile), user_id))
        if weight_history is not None:
            c.execute('UPDATE users SET weight_history = ? WHERE id = ?', (json.dumps(weight_history), user_id))
        if favorites is not None:
            c.execute('UPDATE users SET favorites = ? WHERE id = ?', (json.dumps(favorites), user_id))

        for m in meals_to_save:
            c.execute('''
                INSERT INTO meals (id, user_id, meal_date, meal_time, meal_type, items, total, created_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                ON CONFLICT(id) DO UPDATE SET
                    meal_time=excluded.meal_time,
                    meal_type=excluded.meal_type,
                    items=excluded.items,
                    total=excluded.total
            ''', (
                m['id'], user_id, m['date'], m['time'], m['type'], 
                json.dumps(m['items']), json.dumps(m['total']), m['createdAt']
            ))

        conn.commit()
        return jsonify({'success': True})
    except Exception as e:
        return jsonify({'error': f'Sync failed: {str(e)}'}), 500
    finally:
        conn.close()

@app.route('/api/delete-meal', methods=['DELETE'])
def delete_meal():
    auth = get_authenticated_user()
    if not auth:
        return jsonify({'error': 'Brak autoryzacji'}), 401
    user_id, _ = auth

    meal_id = request.args.get('id')
    if not meal_id:
        return jsonify({'error': 'Brak identyfikatora posiłku'}), 400

    conn = sqlite3.connect(DB_FILE)
    c = conn.cursor()
    c.execute('DELETE FROM meals WHERE id = ? AND user_id = ?', (meal_id, user_id))
    conn.commit()
    conn.close()

    return jsonify({'success': True})

# --- Server Start (Local Environment fallback) ---
if __name__ == '__main__':
    init_db()
    print("Uruchamianie lokalnego serwera Flask CalorieAI...")
    app.run(port=3000, host='0.0.0.0')
