import pymysql
import os
from dotenv import load_dotenv
import logging

logging.basicConfig(level=logging.INFO)
load_dotenv()

def create_database():
    try:
        connection = pymysql.connect(
            host=os.getenv('DB_HOST', 'localhost'),
            user=os.getenv('DB_USER'),
            password=os.getenv('DB_PASSWORD'),
            port=int(os.getenv('DB_PORT', 3306))
        )
        
        with connection.cursor() as cursor:
            cursor.execute("CREATE DATABASE IF NOT EXISTS reliefnet")
            logging.info("Database 'reliefnet' created or already exists")
            
            cursor.execute("USE reliefnet")
            
            cursor.execute("DROP TABLE IF EXISTS help_requests")
            
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS help_requests (
                    id VARCHAR(50) PRIMARY KEY,
                    name VARCHAR(255) NOT NULL,
                    phone VARCHAR(50) NOT NULL,
                    resource_type TEXT,
                    latitude DECIMAL(10, 8) NOT NULL,
                    longitude DECIMAL(11, 8) NOT NULL,
                    description TEXT,
                    is_resolved BOOLEAN DEFAULT FALSE,
                    timestamp BIGINT NOT NULL,
                    disaster_type VARCHAR(50) NOT NULL,
                    INDEX idx_timestamp (timestamp),
                    INDEX idx_resolved (is_resolved)
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
            """)
            
            connection.commit()
            logging.info("Table 'help_requests' created successfully!")
            
            cursor.execute("""
                INSERT INTO help_requests (id, name, phone, resource_type, latitude, longitude, description, timestamp, disaster_type)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
            """, (
                'test123',
                'Test User',
                '+1234567890',
                'water,food',
                12.9716,
                77.5946,
                'Test request',
                1234567890,
                'earthquake'
            ))

            cursor.execute("""
                INSERT INTO help_requests (id, name, phone, resource_type, latitude, longitude, description, timestamp, disaster_type)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
            """, (
                'jaitpur floods',
                'Test User',
                '+1893218599',
                'water,food',
                28.50301,
                77.31847,
                'Food',
                1234567890,
                'flood'
            ))
            
            connection.commit()
            logging.info("Test data inserted successfully!")
    
    except Exception as e:
        logging.error(f"Error setting up database: {e}")
        raise
    
    finally:
        if connection:
            connection.close()

if __name__ == "__main__":
    create_database()