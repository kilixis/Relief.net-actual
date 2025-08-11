from flask import Flask, request, jsonify
from flask_cors import CORS
import pymysql
import os
from datetime import datetime
from dotenv import load_dotenv
import logging

# Set up logging
logging.basicConfig(level=logging.DEBUG)
load_dotenv()

app = Flask(__name__)
CORS(app)

def get_db_connection():
    try:
        connection = pymysql.connect(
            host=os.getenv('DB_HOST', 'localhost'),
            user=os.getenv('DB_USER'),
            password=os.getenv('DB_PASSWORD'),
            database=os.getenv('DB_NAME', 'reliefnet'),
            port=int(os.getenv('DB_PORT', 3306)),
            cursorclass=pymysql.cursors.DictCursor,
            autocommit=True
        )
        return connection
    except Exception as e:
        logging.error(f"Database connection error: {e}")
        raise

@app.route('/api/requests', methods=['GET'])
def get_requests():
    try:
        connection = get_db_connection()
        with connection.cursor() as cursor:
            cursor.execute("SELECT * FROM help_requests WHERE is_resolved = FALSE ORDER BY timestamp DESC")
            requests = cursor.fetchall()
        
        # Convert to proper format
        formatted_requests = []
        for req in requests:
            formatted_requests.append({
                'id': str(req['id']),
                'lat': float(req['latitude']) if req['latitude'] else 0.0,
                'lng': float(req['longitude']) if req['longitude'] else 0.0,
                'disasterType': str(req['disaster_type']),
                'resources': req['resource_type'].split(',') if req['resource_type'] else [],
                'description': str(req['description'] or ''),
                'victimName': str(req['name']),
                'victimPhone': str(req['phone']),
                'createdAt': int(req['timestamp'])
            })
        
        return jsonify(formatted_requests)
    
    except Exception as e:
        logging.error(f"Error in get_requests: {e}")
        return jsonify({'error': f"Database error: {str(e)}"}), 500
    
    finally:
        if 'connection' in locals():
            connection.close()

@app.route('/api/requests', methods=['POST'])
def create_request():
    try:
        data = request.json
        logging.info(f"Received request data: {data}")
        
        # Validate required fields
        required_fields = ['id', 'victimName', 'victimPhone', 'lat', 'lng', 'disasterType', 'createdAt']
        for field in required_fields:
            if field not in data:
                return jsonify({'error': f'Missing required field: {field}'}), 400
        
        connection = get_db_connection()
        with connection.cursor() as cursor:
            # Check if table exists
            cursor.execute("""
                SELECT COUNT(*) as count 
                FROM information_schema.tables 
                WHERE table_schema = %s AND table_name = 'help_requests'
            """, (os.getenv('DB_NAME', 'reliefnet'),))
            
            if cursor.fetchone()['count'] == 0:
                return jsonify({'error': 'Database table not found. Please run setup_db.py first.'}), 500
            
            cursor.execute("""
                INSERT INTO help_requests (id, name, phone, resource_type, latitude, longitude, description, timestamp, disaster_type)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
            """, (
                str(data['id']),
                str(data['victimName']),
                str(data['victimPhone']),
                ','.join([str(r) for r in data['resources']]) if data['resources'] else '',
                float(data['lat']),
                float(data['lng']),
                str(data['description'] or ''),
                int(data['createdAt']),
                str(data['disasterType'])
            ))
            
            connection.commit()
        
        return jsonify({'message': 'Request created successfully'}), 201
    
    except Exception as e:
        logging.error(f"Error in create_request: {e}")
        return jsonify({'error': f"Database error: {str(e)}"}), 500
    
    finally:
        if 'connection' in locals():
            connection.close()

@app.route('/api/requests/<request_id>', methods=['PUT'])
def update_request(request_id):
    try:
        data = request.json
        
        connection = get_db_connection()
        with connection.cursor() as cursor:
            cursor.execute("""
                UPDATE help_requests 
                SET is_resolved = %s 
                WHERE id = %s
            """, (bool(data.get('is_resolved', True)), str(request_id)))
            
            connection.commit()
        
        return jsonify({'message': 'Request updated successfully'})
    
    except Exception as e:
        logging.error(f"Error in update_request: {e}")
        return jsonify({'error': str(e)}), 500
    
    finally:
        if 'connection' in locals():
            connection.close()

@app.route('/api/requests/<request_id>', methods=['DELETE'])
def delete_request(request_id):
    try:
        connection = get_db_connection()
        with connection.cursor() as cursor:
            cursor.execute("DELETE FROM help_requests WHERE id = %s", (str(request_id),))
            connection.commit()
        
        return jsonify({'message': 'Request deleted successfully'})
    
    except Exception as e:
        logging.error(f"Error in delete_request: {e}")
        return jsonify({'error': str(e)}), 500
    
    finally:
        if 'connection' in locals():
            connection.close()

@app.route('/api/health', methods=['GET'])
def health_check():
    try:
        connection = get_db_connection()
        with connection.cursor() as cursor:
            cursor.execute("SELECT 1")
        return jsonify({'status': 'healthy', 'database': 'connected'})
    except Exception as e:
        return jsonify({'status': 'unhealthy', 'error': str(e)}), 500
    finally:
        if 'connection' in locals():
            connection.close()

if __name__ == '__main__':
    app.run(debug=True, port=5000)