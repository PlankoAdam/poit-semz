from flask import Flask, render_template, request, jsonify
from flask_socketio import SocketIO, emit
import threading
import serial
import time
import psycopg2
from datetime import datetime
import json

app = Flask(__name__)
socketio = SocketIO(app)

latest_data = {"distance": 0.0, "light": 0}
record_data = False
current_session_id = None

current_distance_offset = 0
current_light_offset = 0

current_session_data = {}

conn = psycopg2.connect(
	dbname="semzdb",
	user="adpl",
	password="adpl",
	host="localhost",
	port="5432"
)
cursor = conn.cursor()

def read_arduino():
	global latest_data, record_data, current_session_id, current_distance_offset, current_light_offset
	arduino = serial.Serial(port='COM9', baudrate=9600, timeout=1)
	time.sleep(2)
	while True:
		try:
			line = arduino.readline().decode('utf-8').strip()
			if line:
				parts = line.split(',')
				if len(parts) == 2:
					distance = float(parts[0]) + current_distance_offset
					light = int(parts[1]) + current_light_offset
					latest_data = {"distance": distance, "light": light}

					# Send live update to client
					socketio.emit('sensor_data', latest_data)

					if record_data and current_session_id is not None:
						ts = datetime.now()
						cursor.execute(
							"INSERT INTO sensor_readings (time, session_id, distance_cm, light_level) VALUES (%s, %s, %s, %s)",
							(ts, current_session_id, distance, light)
						)
						conn.commit()
						current_session_data["readings"].append({"time":ts.strftime("%d/%m/%Y, %H:%M:%S"),"distance":distance,"light":light})
		except Exception as e:
			print("Error:", e)
			break

# Start background thread for sensor reading
threading.Thread(target=read_arduino, daemon=True).start()

@app.route("/")
def index_page():
	return render_template("index.html")

@app.route("/archive")
def archive_page():
	return render_template("archive.html")

@socketio.on('update_offsets')
def update_offsets(data):
	global current_distance_offset, current_light_offset
	current_distance_offset = float(data.get('distance_offset', 0.0))
	current_light_offset = float(data.get('light_offset', 0.0))

@socketio.on('toggle_recording')
def handle_toggle():
	global record_data, current_session_id, current_distance_offset, current_light_offset, current_session_data
	record_data = not record_data

	if record_data:
		# Insert a new session with offsets
		ts = datetime.now()
		cursor.execute("""
			INSERT INTO recording_sessions (start_time, distance_offset, light_offset)
			VALUES (%s, %s, %s)
			RETURNING id
		""", (ts, current_distance_offset, current_light_offset))

		current_session_id = cursor.fetchone()[0]
		conn.commit()
	
		current_session_data = {"id":current_session_id,"start_time":ts.strftime("%d/%m/%Y, %H:%M:%S"),"distance_offset":current_distance_offset,"light_offset":current_light_offset,"readings":[]}
	
		print(f"Started session {current_session_id} with offsets: distance={current_distance_offset}, light={current_light_offset}")
	else:
		with open("data.txt", "a") as f:
			f.write(json.dumps(current_session_data))
			f.write("\n")
		print(f"Stopped session {current_session_id}")
		current_session_id = None

	emit('recording_state', {'recording': record_data}, broadcast=True)

@app.route("/api/sessions")
def get_sessions():
	cursor.execute("""
		SELECT id, start_time, distance_offset, light_offset
		FROM recording_sessions
		ORDER BY start_time DESC
	""")
	rows = cursor.fetchall()
	sessions = [
		{
			"id": row[0],
			"start_time": row[1].isoformat(),
			"distance_offset": row[2],
			"light_offset": row[3]
		}
		for row in rows
	]
	return jsonify(sessions)

@app.route("/api/sessions/<int:session_id>")
def get_session_data(session_id):
	# Get session metadata
	cursor.execute("""
		SELECT id, start_time, distance_offset, light_offset
		FROM recording_sessions
		WHERE id = %s
	""", (session_id,))
	session_row = cursor.fetchone()
 
	if not session_row:
		return jsonify({"error":"Session not found"}), 404

	session_info = {
		"id": session_row[0],
		"start_time": session_row[1].isoformat(),
		"distance_offset": session_row[2],
		"light_offset": session_row[3]
	}	
 
	cursor.execute("""
		SELECT time, distance_cm, light_level
		FROM sensor_readings
		WHERE session_id = %s
		ORDER BY time
	""", (session_id,))
	rows = cursor.fetchall()
	readings = [
		{
			"timestamp": row[0].isoformat(),
			"distance_cm": row[1],
			"light_level": row[2]
		}
		for row in rows
	]
	return jsonify({
		"session":session_info,
		"readings":readings
	})


if __name__ == "__main__":
	socketio.run(app, debug=True, use_reloader=False)
