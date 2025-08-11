import mysql.connector
import math

# Haversine formula to calculate distance in kilometers
def haversine(lat1, lon1, lat2, lon2):
    R = 6371  # Radius of Earth in km
    phi1, phi2 = math.radians(lat1), math.radians(lat2)
    dphi = math.radians(lat2 - lat1)
    dlambda = math.radians(lon2 - lon1)
    a = math.sin(dphi/2)**2 + math.cos(phi1) * math.cos(phi2) * math.sin(dlambda/2)**2
    return 2 * R * math.atan2(math.sqrt(a), math.sqrt(1 - a))

# Connect to MySQL
conn = mysql.connector.connect(
    host="localhost",
    user="root",
    password="am@198001",  
    database=" indian_public_services"
)
cursor = conn.cursor()
# Example usage
user_lat = float(input("Enter your latitude: "))
user_lon = float(input("Enter your longitude: "))

# Function to find nearest location
def find_nearest(table, user_lat, user_lon):
    cursor.execute(f"SELECT name, address, latitude, longitude FROM {table}")
    nearest_name, nearest_address = None, None
    min_distance = float("inf")

    for name, address, lat, lon in cursor.fetchall():
        distance = haversine(user_lat, user_lon, lat, lon)
        if distance < min_distance:
            min_distance = distance
            nearest_name = name
            nearest_address = address

    return nearest_name, nearest_address, min_distance

nearest_police, police_address, police_dist = find_nearest("police_stations", user_lat, user_lon)
nearest_hospital, hospital_address, hospital_dist = find_nearest("hospitals", user_lat, user_lon)

print(f"Nearest Police Station: {nearest_police} ({police_dist:.2f} km away)")
print(f"Address: {police_address}")
print(f"Nearest Hospital: {nearest_hospital} ({hospital_dist:.2f} km away)")
print(f"Address: {hospital_address}")


# Close connection
cursor.close()
conn.close()
