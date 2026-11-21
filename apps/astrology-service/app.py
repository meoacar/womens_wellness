from flask import Flask, request, jsonify
from flask_cors import CORS
from kerykeion import AstrologicalSubject
from datetime import datetime

app = Flask(__name__)
CORS(app)

@app.route('/health', methods=['GET'])
def health():
    return jsonify({'status': 'ok'})

@app.route('/calculate-birth-chart', methods=['POST'])
def calculate_birth_chart():
    try:
        data = request.json
        
        # Parse input
        birth_date = data.get('birthDate')  # ISO string
        birth_time = data.get('birthTime')  # HH:MM
        city = data.get('city', 'Istanbul')
        
        # Parse date and time
        dt = datetime.fromisoformat(birth_date.replace('Z', '+00:00'))
        hours, minutes = birth_time.split(':')
        
        # Create astrological subject
        subject = AstrologicalSubject(
            name="User",
            year=dt.year,
            month=dt.month,
            day=dt.day,
            hour=int(hours),
            minute=int(minutes),
            city=city,
            nation="TR"
        )
        
        # Sign name mapping
        sign_map = {
            'Ari': 'aries', 'Tau': 'taurus', 'Gem': 'gemini', 'Can': 'cancer',
            'Leo': 'leo', 'Vir': 'virgo', 'Lib': 'libra', 'Sco': 'scorpio',
            'Sag': 'sagittarius', 'Cap': 'capricorn', 'Aqu': 'aquarius', 'Pis': 'pisces'
        }
        
        # Get zodiac signs
        sun_sign_raw = subject.sun.get('sign', 'Ari')
        moon_sign_raw = subject.moon.get('sign', 'Ari')
        rising_sign_raw = subject.first_house.get('sign', 'Ari')
        
        sun_sign = sign_map.get(sun_sign_raw, 'aries')
        moon_sign = sign_map.get(moon_sign_raw, 'aries')
        rising_sign = sign_map.get(rising_sign_raw, 'aries')
        
        # Get degrees
        sun_degree = subject.sun.get('position', 0)
        moon_degree = subject.moon.get('position', 0)
        rising_degree = subject.first_house.get('position', 0)
        
        return jsonify({
            'sunSign': sun_sign,
            'moonSign': moon_sign,
            'risingSign': rising_sign,
            'sunDegree': sun_degree,
            'moonDegree': moon_degree,
            'risingDegree': rising_degree
        })
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

if __name__ == '__main__':
    import os
    port = int(os.environ.get('PORT', 5001))
    debug = (
        os.environ.get('FLASK_ENV') == 'development'
        or os.environ.get('FLASK_DEBUG', '').lower() == 'true'
    )
    app.run(host='0.0.0.0', port=port, debug=debug)
