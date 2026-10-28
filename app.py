import json
import math
import os
import re
import secrets
from datetime import datetime, date
from functools import wraps
from zoneinfo import ZoneInfo

from flask import Flask, jsonify, render_template, request, session
from flask_sqlalchemy import SQLAlchemy
from sqlalchemy import desc, inspect, text

BASE_DIR = os.path.abspath(os.path.dirname(__file__))
os.makedirs(os.path.join(BASE_DIR, "instance"), exist_ok=True)

app = Flask(__name__)
app.config["SECRET_KEY"] = os.environ.get("SECRET_KEY", "dev-only-change-this-secret-key")
app.config["SESSION_COOKIE_HTTPONLY"] = True
app.config["SESSION_COOKIE_SAMESITE"] = "Lax"
app.config["SESSION_COOKIE_SECURE"] = os.environ.get("COOKIE_SECURE", "").lower() == "true"
app.config["MAX_CONTENT_LENGTH"] = 25 * 1024 * 1024

db_url = (os.environ.get("DATABASE_URL") or "sqlite:///cafe.db").strip()
if db_url.startswith("postgres://"):
    db_url = "postgresql+psycopg://" + db_url[len("postgres://"):]
elif db_url.startswith("postgresql://"):
    db_url = "postgresql+psycopg://" + db_url[len("postgresql://"):]
app.config["SQLALCHEMY_DATABASE_URI"] = db_url
app.config["SQLALCHEMY_TRACK_MODIFICATIONS"] = False
if db_url.startswith("postgresql"):
    app.config["SQLALCHEMY_ENGINE_OPTIONS"] = {"connect_args": {"sslmode": "require"}}

db = SQLAlchemy(app)

DEFAULT_SETTINGS = {
    "brand_name": "RESPAWN CAFE",
    "tagline": "EAT • DRINK • PLAY",
    "hero_subtitle": "Elevate Your Gaming Experience With Us.",
    "location": "Cumilla, Bangladesh",
    "address": "Comilla Police Line, opposite of Eastern Bank, Cumilla, Bangladesh",
    "phone": "01XXXXXXXXX",
    "email": "hello@yourcafe.com",
    "bkash_number": "",
    "nagad_number": "",
    "open_time": "08:00",
    "close_time": "00:00",
    "logo_image": "",
    "hero_image": "https://www.respawncafebd.com/assets/hero-gamers-bg.png",
    "hero_game_one": "/static/images/fc26-poster.jpg",
    "hero_game_two": "/static/images/spiderman-poster.jpg",
    "hero_game_one_label": "FC 26",
    "hero_game_two_label": "ACTION GAMES",
    "footer_note": "Your next match starts here.",
    "promo_enabled": "NO",
    "promo_percent": "10",
    "promo_scope": "all",
    "promo_title": "LEVEL UP YOUR NEXT SESSION",
}

class SiteSetting(db.Model):
    key = db.Column(db.String(80), primary_key=True)
    value = db.Column(db.Text, nullable=False, default="")

class GameSetup(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(120), nullable=False)
    description = db.Column(db.Text, default="")
    prices_json = db.Column(db.Text, nullable=False, default="{}")
    image_url = db.Column(db.Text, default="")
    capacity = db.Column(db.Integer, default=1)
    active = db.Column(db.Boolean, default=True)
    coming_soon = db.Column(db.Boolean, default=False)

    @property
    def prices(self):
        try:
            return json.loads(self.prices_json or "{}")
        except (ValueError, TypeError):
            return {}

class MenuItem(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(120), nullable=False)
    category = db.Column(db.String(60), nullable=False, default="Snacks")
    description = db.Column(db.Text, default="")
    price = db.Column(db.Float, nullable=False, default=0)
    image_url = db.Column(db.Text, default="")
    active = db.Column(db.Boolean, default=True)

class ComboPass(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(120), nullable=False)
    subtitle = db.Column(db.String(240), default="")
    details = db.Column(db.Text, default="")
    price = db.Column(db.Float, nullable=False, default=0)
    original_price = db.Column(db.Float, nullable=False, default=0)
    active = db.Column(db.Boolean, default=True)

class Booking(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    reference = db.Column(db.String(24), unique=True, nullable=False)
    customer_name = db.Column(db.String(120), nullable=False)
    email = db.Column(db.String(180), nullable=False)
    phone = db.Column(db.String(50), nullable=False)
    address = db.Column(db.Text, nullable=False)
    setup_id = db.Column(db.Integer, db.ForeignKey("game_setup.id"), nullable=True)
    setup_name = db.Column(db.String(120), nullable=False)
    booking_date = db.Column(db.String(10), nullable=False)
    start_time = db.Column(db.String(5), nullable=False)
    duration_minutes = db.Column(db.Integer, nullable=False)
    amount = db.Column(db.Float, nullable=False, default=0)
    base_amount = db.Column(db.Float, nullable=False, default=0)
    extra_controllers = db.Column(db.Integer, nullable=False, default=0)
    controller_fee = db.Column(db.Float, nullable=False, default=0)
    food_items_json = db.Column(db.Text, nullable=False, default="[]")
    food_total = db.Column(db.Float, nullable=False, default=0)
    pass_id = db.Column(db.Integer, nullable=True)
    pass_name = db.Column(db.String(120), nullable=False, default="")
    pass_amount = db.Column(db.Float, nullable=False, default=0)
    discount_percent = db.Column(db.Float, nullable=False, default=0)
    discount_amount = db.Column(db.Float, nullable=False, default=0)
    station_number = db.Column(db.Integer, nullable=False, default=1)
    payment_method = db.Column(db.String(20), nullable=False, default="bkash")
    payment_amount = db.Column(db.Float, nullable=False, default=0)
    payment_txn_id = db.Column(db.String(100), nullable=False, default="")
    payment_status = db.Column(db.String(20), nullable=False, default="unpaid")
    notes = db.Column(db.Text, default="")
    status = db.Column(db.String(20), nullable=False, default="pending")
    created_at = db.Column(db.DateTime, nullable=False, default=datetime.utcnow)


def get_setting(key, default=None):
    row = db.session.get(SiteSetting, key)
    if row is None:
        return DEFAULT_SETTINGS.get(key, default)
    return row.value


def put_setting(key, value):
    row = db.session.get(SiteSetting, key)
    if row is None:
        row = SiteSetting(key=key, value=str(value))
        db.session.add(row)
    else:
        row.value = str(value)


def site_settings():
    values = dict(DEFAULT_SETTINGS)
    for row in SiteSetting.query.all():
        values[row.key] = row.value
    return values


def seed_database():
    for key, value in DEFAULT_SETTINGS.items():
        if db.session.get(SiteSetting, key) is None:
            db.session.add(SiteSetting(key=key, value=value))
    if GameSetup.query.count() == 0:
        setups = [
            GameSetup(name="PS5 Premium VIP Room", description="Private VIP booth, 2 controllers and a chill-zone setup.", prices_json=json.dumps({"30": 220, "60": 320, "90": 480, "120": 640, "180": 960}), image_url="/static/images/spiderman-poster.jpg", capacity=1, active=True),
            GameSetup(name="PS5 Standard", description="Play your favourite console games with 2 controllers.", prices_json=json.dumps({"30": 150, "60": 220, "90": 330, "120": 440, "180": 660}), image_url="/static/images/fc26-poster.jpg", capacity=4, active=True),
            GameSetup(name="Racing Simulator", description="Force-feedback wheel and a dedicated racing cockpit.", prices_json=json.dumps({"30": 180, "60": 280, "90": 420, "120": 560}), image_url="/static/images/fc26-poster.jpg", capacity=2, active=True),
            GameSetup(name="Arcade Cabinet", description="Classic fighting, retro and arcade favourites.", prices_json=json.dumps({"15": 50, "30": 80, "60": 120}), image_url="/static/images/spiderman-poster.jpg", capacity=2, active=True),
            GameSetup(name="VR Arena", description="Virtual reality games. Edit this setup when your VR station is ready.", prices_json=json.dumps({"15": 150, "30": 250, "60": 400}), image_url="/static/images/spiderman-poster.jpg", capacity=1, active=True, coming_soon=True),
        ]
        db.session.add_all(setups)
    if MenuItem.query.count() == 0:
        menu = [
            MenuItem(name="Chicken Burger", category="Burgers", description="Juicy chicken patty with house sauce.", price=220, image_url="", active=True),
            MenuItem(name="French Fries", category="Snacks", description="Crispy golden fries.", price=120, image_url="", active=True),
            MenuItem(name="Chicken Wings", category="Snacks", description="Saucy wings for your gaming break.", price=260, image_url="", active=True),
            MenuItem(name="Chicken Chowmein", category="Meals", description="Hot wok-tossed noodles.", price=180, image_url="", active=True),
            MenuItem(name="Cold Coffee", category="Drinks", description="Chilled coffee for long sessions.", price=150, image_url="", active=True),
            MenuItem(name="Lemon Iced Tea", category="Drinks", description="Cold, refreshing and citrusy.", price=100, image_url="", active=True),
        ]
        db.session.add_all(menu)
    if ComboPass.query.count() == 0:
        passes = [
            ComboPass(name="Ultimate Combo Pass", subtitle="The best of your weekend gaming.", details="PS5 Standard · 1 hour (2 controllers)\nRacing Simulator · 30 minutes\nRetro Arcade · 30 minutes\nClaw Machine · 4 tokens", price=450, original_price=580, active=True),
            ComboPass(name="VIP Combo Pass", subtitle="A premium chill-zone session.", details="PS5 Premium VIP · 1 hour\nRacing Simulator · 30 minutes\nRetro Arcade · 30 minutes\nClaw Machine · 4 tokens", price=550, original_price=680, active=True),
        ]
        db.session.add_all(passes)
    db.session.commit()

def migrate_database_schema():
    """Add new booking fields and safely assign legacy bookings to stations."""
    columns = {column["name"] for column in inspect(db.engine).get_columns("booking")}
    new_station_column = "station_number" not in columns
    new_base_amount_column = "base_amount" not in columns
    new_payment_method_column = "payment_method" not in columns
    additions = {
        "base_amount": "FLOAT NOT NULL DEFAULT 0",
        "extra_controllers": "INTEGER NOT NULL DEFAULT 0",
        "controller_fee": "FLOAT NOT NULL DEFAULT 0",
        "food_items_json": "TEXT NOT NULL DEFAULT '[]'",
        "food_total": "FLOAT NOT NULL DEFAULT 0",
        "station_number": "INTEGER NOT NULL DEFAULT 1",
        "payment_method": "VARCHAR(20) NOT NULL DEFAULT 'not_recorded'",
        "payment_amount": "FLOAT NOT NULL DEFAULT 0",
        "payment_txn_id": "VARCHAR(100) NOT NULL DEFAULT ''",
        "payment_status": "VARCHAR(20) NOT NULL DEFAULT 'unpaid'",
        "pass_id": "INTEGER",
        "pass_name": "VARCHAR(120) NOT NULL DEFAULT ''",
        "pass_amount": "FLOAT NOT NULL DEFAULT 0",
        "discount_percent": "FLOAT NOT NULL DEFAULT 0",
        "discount_amount": "FLOAT NOT NULL DEFAULT 0",
    }
    with db.engine.begin() as connection:
        for column, sql_type in additions.items():
            if column not in columns:
                connection.execute(text(f"ALTER TABLE booking ADD COLUMN {column} {sql_type}"))
        if new_base_amount_column:
            connection.execute(text("UPDATE booking SET base_amount = amount WHERE base_amount = 0 AND amount > 0"))

    # Older versions used a capacity count, not a specific station number. Reassign
    # those historical bookings across the setup's capacity so the new per-station
    # schedule does not incorrectly mark every legacy booking as Station 1.
    if new_station_column:
        active_bookings = Booking.query.filter(
            Booking.status.in_(["pending", "confirmed"])
        ).order_by(Booking.booking_date, Booking.start_time, Booking.id).all()
        allocations = {}
        def parse_legacy_start(value):
            try:
                hour, minute = map(int, value.split(":"))
                return hour * 60 + minute
            except (ValueError, AttributeError):
                return None
        for booking in active_bookings:
            setup = db.session.get(GameSetup, booking.setup_id) if booking.setup_id else None
            capacity = max(1, int(setup.capacity or 1)) if setup else 1
            start = parse_legacy_start(booking.start_time)
            end = (start + int(booking.duration_minutes)) if start is not None else None
            key = (booking.setup_id, booking.booking_date)
            chosen = 1
            if start is not None and end is not None:
                for candidate in range(1, capacity + 1):
                    existing = allocations.get((*key, candidate), [])
                    if not any(start < other_end and end > other_start for other_start, other_end in existing):
                        chosen = candidate
                        break
                allocations.setdefault((*key, chosen), []).append((start, end))
            booking.station_number = chosen
        db.session.commit()

    # This field was not recorded by the old app. Avoid implying that the customer
    # selected a wallet method before this feature existed.
    if new_payment_method_column:
        with db.engine.begin() as connection:
            connection.execute(text("UPDATE booking SET payment_method = 'not_recorded'"))


with app.app_context():
    db.create_all()
    migrate_database_schema()
    seed_database()


def is_admin():
    return session.get("is_admin") is True


def admin_required(fn):
    @wraps(fn)
    def wrapper(*args, **kwargs):
        if not is_admin():
            return jsonify({"ok": False, "error": "Please sign in to the admin panel."}), 401
        return fn(*args, **kwargs)
    return wrapper


def setup_dict(s):
    return {"id": s.id, "name": s.name, "description": s.description, "prices": s.prices,
            "image_url": s.image_url or "", "capacity": s.capacity, "active": bool(s.active),
            "coming_soon": bool(s.coming_soon)}


def menu_dict(m):
    return {"id": m.id, "name": m.name, "category": m.category, "description": m.description,
            "price": m.price, "image_url": m.image_url or "", "active": bool(m.active)}


def pass_dict(p):
    return {"id": p.id, "name": p.name, "subtitle": p.subtitle, "details": p.details,
            "price": p.price, "original_price": p.original_price, "active": bool(p.active)}


def booking_dict(b):
    try:
        food_items = json.loads(b.food_items_json or "[]")
    except (ValueError, TypeError):
        food_items = []
    return {"id": b.id, "reference": b.reference, "customer_name": b.customer_name, "email": b.email,
            "phone": b.phone, "address": b.address, "setup_id": b.setup_id, "setup_name": b.setup_name,
            "booking_date": b.booking_date, "start_time": b.start_time, "duration_minutes": b.duration_minutes,
            "amount": b.amount, "base_amount": b.base_amount, "extra_controllers": b.extra_controllers,
            "controller_fee": b.controller_fee, "food_items": food_items, "food_total": b.food_total,
            "pass_id": b.pass_id, "pass_name": b.pass_name, "pass_amount": b.pass_amount,
            "discount_percent": b.discount_percent, "discount_amount": b.discount_amount,
            "station_number": b.station_number, "payment_method": b.payment_method,
            "payment_amount": b.payment_amount, "payment_txn_id": b.payment_txn_id,
            "payment_status": b.payment_status, "notes": b.notes, "status": b.status,
            "created_at": b.created_at.strftime("%Y-%m-%d %H:%M") if b.created_at else ""}


def public_settings(settings):
    keys = ["brand_name", "tagline", "hero_subtitle", "location", "address", "phone", "email",
            "open_time", "close_time", "logo_image", "hero_image", "hero_game_one", "hero_game_two",
            "hero_game_one_label", "hero_game_two_label", "footer_note", "bkash_number", "nagad_number",
            "promo_enabled", "promo_percent", "promo_scope", "promo_title"]
    return {key: settings.get(key, DEFAULT_SETTINGS.get(key, "")) for key in keys}


@app.route("/")
def home():
    return render_template("index.html", page="home")


@app.route("/gaming")
def gaming_page():
    return render_template("index.html", page="gaming")


@app.route("/cafe")
def cafe_page():
    return render_template("index.html", page="cafe")


@app.route("/tournaments")
def tournaments_page():
    return render_template("index.html", page="tournaments")


@app.route("/book")
def booking_page():
    return render_template("index.html", page="book")


@app.route("/admin")
def admin_page():
    return render_template("admin.html")


@app.route("/track")
def track_page():
    return render_template("track.html")


@app.get("/api/public-data")
def public_data():
    settings = site_settings()
    return jsonify({
        "settings": public_settings(settings),
        "setups": [setup_dict(s) for s in GameSetup.query.filter_by(active=True).order_by(GameSetup.id).all()],
        "menu": [menu_dict(m) for m in MenuItem.query.filter_by(active=True).order_by(MenuItem.category, MenuItem.name).all()],
        "passes": [pass_dict(p) for p in ComboPass.query.filter_by(active=True).order_by(ComboPass.id).all()],
    })


def time_to_minutes(value, closing=False):
    try:
        hour, minute = map(int, value.split(":"))
        if closing and hour == 0 and minute == 0:
            return 1440
        return hour * 60 + minute
    except Exception:
        return None


@app.get("/api/available-times")
def available_times():
    """Return every possible start time with its state for a chosen individual station."""
    try:
        setup_id = int(request.args.get("setup_id", ""))
        duration = int(request.args.get("duration_minutes", ""))
        book_date = date.fromisoformat(request.args.get("booking_date", ""))
        station_number = int(request.args.get("station_number", "1"))
    except (ValueError, TypeError):
        return jsonify({"ok": True, "slots": []})
    setup = db.session.get(GameSetup, setup_id)
    if (not setup or not setup.active or setup.coming_soon or str(duration) not in setup.prices
            or station_number < 1 or station_number > max(1, setup.capacity or 1)):
        return jsonify({"ok": True, "slots": []})
    settings = site_settings()
    opening = time_to_minutes(settings.get("open_time", "08:00"))
    closing = time_to_minutes(settings.get("close_time", "00:00"), closing=True)
    if opening is None or closing is None or closing <= opening:
        return jsonify({"ok": True, "slots": []})
    now_bd = datetime.now(ZoneInfo("Asia/Dhaka"))
    if book_date < now_bd.date():
        return jsonify({"ok": True, "slots": []})
    existing_bookings = Booking.query.filter(
        Booking.setup_id == setup.id,
        Booking.station_number == station_number,
        Booking.booking_date == book_date.isoformat(),
        Booking.status.in_(["pending", "confirmed"]),
    ).all()
    slots = []
    first_slot = ((opening + 29) // 30) * 30
    for start in range(first_slot, closing - duration + 1, 30):
        if book_date == now_bd.date() and start < now_bd.hour * 60 + now_bd.minute + 5:
            continue
        end = start + duration
        overlapping = []
        for booked in existing_bookings:
            other_start = time_to_minutes(booked.start_time)
            if other_start is not None and start < other_start + booked.duration_minutes and end > other_start:
                overlapping.append(booked)
        if not overlapping:
            state = "available"
        elif any(booking.status == "confirmed" for booking in overlapping):
            state = "booked"
        else:
            state = "pending"
        slots.append({"start": f"{start // 60:02d}:{start % 60:02d}",
                      "end": f"{(end // 60) % 24:02d}:{end % 60:02d}",
                      "end_minutes": end, "state": state})
    return jsonify({"ok": True, "slots": slots})


def valid_image_value(value):
    if not isinstance(value, str):
        return False
    if not value:
        return True
    if value.startswith("/static/") or value.startswith("https://") or value.startswith("http://"):
        return len(value) <= 2000
    if value.startswith("data:image/"):
        return len(value) <= 5_500_000
    return False


def controller_price(duration_minutes):
    """Pricing follows the on-page guide: BDT 50/30 min or BDT 80/hour."""
    if duration_minutes <= 30:
        return 50.0
    return 80.0 + max(0, (duration_minutes - 60 + 29) // 30) * 50.0


def make_booking_reference():
    """Generate a reference code and check it against the unique database field."""
    for _ in range(10):
        reference = "RSC-" + secrets.token_hex(6).upper()
        if not Booking.query.filter_by(reference=reference).first():
            return reference
    raise RuntimeError("Could not generate a unique booking reference. Please retry.")


@app.post("/api/bookings")
def create_booking():
    data = request.get_json(silent=True) or {}
    required = ["customer_name", "phone", "setup_id", "booking_date", "start_time", "duration_minutes"]
    if any(not str(data.get(field, "")).strip() for field in required):
        return jsonify({"ok": False, "error": "Please complete all required fields."}), 400
    email = str(data.get("email", "")).strip()
    if email and not re.match(r"^[^\s@]+@[^\s@]+\.[^\s@]+$", email):
        return jsonify({"ok": False, "error": "Enter a valid email address or leave it blank."}), 400
    try:
        setup_id = int(data["setup_id"])
        duration = int(data["duration_minutes"])
        book_date = date.fromisoformat(str(data["booking_date"]))
        station_number = int(data.get("station_number", 1))
        extra_controllers = int(data.get("extra_controllers", 0))
        payment_amount = round(float(data.get("payment_amount", 0) or 0), 2)
    except (ValueError, TypeError):
        return jsonify({"ok": False, "error": "Invalid date, setup, station, duration or payment amount."}), 400
    if extra_controllers < 0 or extra_controllers > 6:
        return jsonify({"ok": False, "error": "You can add between 0 and 6 extra controllers."}), 400
    payment_method = str(data.get("payment_method", "")).strip().lower()
    if payment_method not in ("bkash", "nagad"):
        return jsonify({"ok": False, "error": "Choose bKash or Nagad as your manual payment method."}), 400
    payment_txn_id = str(data.get("payment_txn_id", "")).strip()[:100]
    setup = db.session.get(GameSetup, setup_id)
    if not setup or not setup.active or setup.coming_soon:
        return jsonify({"ok": False, "error": "This setup is not available for booking right now."}), 400
    if station_number < 1 or station_number > max(1, setup.capacity or 1):
        return jsonify({"ok": False, "error": "Choose a valid station."}), 400
    prices = setup.prices
    if str(duration) not in prices:
        return jsonify({"ok": False, "error": "That duration is not available for this setup."}), 400
    start = time_to_minutes(str(data["start_time"]))
    if start is None or start % 30 != 0:
        return jsonify({"ok": False, "error": "Choose a valid start time in 30-minute intervals."}), 400
    settings = site_settings()
    opening = time_to_minutes(settings.get("open_time", "08:00"))
    closing = time_to_minutes(settings.get("close_time", "00:00"), closing=True)
    if opening is None or closing is None or closing <= opening:
        return jsonify({"ok": False, "error": "Cafe opening hours are not configured correctly. Please contact the cafe."}), 500
    end = start + duration
    if start < opening or end > closing:
        return jsonify({"ok": False, "error": f"Choose a session within opening hours ({settings.get('open_time')}–{settings.get('close_time')})."}), 400
    bd_now = datetime.now(ZoneInfo("Asia/Dhaka"))
    if book_date < bd_now.date():
        return jsonify({"ok": False, "error": "Please choose today or a future date."}), 400
    if book_date == bd_now.date() and start < bd_now.hour * 60 + bd_now.minute + 5:
        return jsonify({"ok": False, "error": "That time has already passed. Choose a later time."}), 400

    active_bookings = Booking.query.filter(
        Booking.setup_id == setup.id,
        Booking.station_number == station_number,
        Booking.booking_date == book_date.isoformat(),
        Booking.status.in_(["pending", "confirmed"]),
    ).all()
    for existing in active_bookings:
        existing_start = time_to_minutes(existing.start_time)
        if existing_start is not None and start < existing_start + existing.duration_minutes and end > existing_start:
            return jsonify({"ok": False, "error": "This station is already booked or awaiting confirmation for that time. Please choose another slot."}), 409

    # Validate food choices against the server's current active menu and preserve price snapshots.
    requested_food = data.get("food_items", [])
    if not isinstance(requested_food, list) or len(requested_food) > 50:
        return jsonify({"ok": False, "error": "Invalid food selection."}), 400
    quantities = {}
    try:
        for item in requested_food:
            item_id = int(item.get("id"))
            quantity = int(item.get("quantity", 1))
            if quantity < 1 or quantity > 50:
                raise ValueError
            quantities[item_id] = quantities.get(item_id, 0) + quantity
            if quantities[item_id] > 50:
                raise ValueError
    except (AttributeError, ValueError, TypeError):
        return jsonify({"ok": False, "error": "Food quantities must be between 1 and 50."}), 400
    food_lines = []
    food_total = 0.0
    for item_id, quantity in quantities.items():
        menu_item = db.session.get(MenuItem, item_id)
        if not menu_item or not menu_item.active:
            return jsonify({"ok": False, "error": "A selected food or drink is no longer available. Refresh the menu and try again."}), 400
        line_total = round(float(menu_item.price) * quantity, 2)
        food_total += line_total
        food_lines.append({"id": menu_item.id, "name": menu_item.name, "quantity": quantity,
                           "unit_price": round(float(menu_item.price), 2), "line_total": line_total})
    food_total = round(food_total, 2)

    base_amount = round(float(prices[str(duration)]), 2)
    controller_fee = round(controller_price(duration) * extra_controllers, 2)

    # Combo/player pass prices are looked up server-side; posted client prices are never trusted.
    pass_id_raw = str(data.get("pass_id", "")).strip()
    selected_pass = None
    pass_amount = 0.0
    if pass_id_raw:
        try:
            selected_pass = db.session.get(ComboPass, int(pass_id_raw))
        except (TypeError, ValueError):
            selected_pass = None
        if not selected_pass or not selected_pass.active:
            return jsonify({"ok": False, "error": "That player pass is no longer available. Refresh and choose another."}), 400
        pass_amount = round(float(selected_pass.price), 2)

    subtotal = round(base_amount + controller_fee + food_total + pass_amount, 2)
    promo_enabled = str(settings.get("promo_enabled", "NO")).upper() == "YES"
    try:
        promo_percent = float(settings.get("promo_percent", "0") or 0)
    except (ValueError, TypeError):
        promo_percent = 0.0
    promo_percent = min(100.0, max(0.0, promo_percent)) if math.isfinite(promo_percent) else 0.0
    promo_scope = str(settings.get("promo_scope", "all")).lower()
    eligible_amount = 0.0
    if promo_enabled and promo_percent > 0:
        if promo_scope == "all":
            eligible_amount = subtotal
        elif promo_scope == "session":
            eligible_amount = base_amount
        elif promo_scope == "pass":
            eligible_amount = pass_amount
        elif promo_scope == "extras":
            eligible_amount = controller_fee + food_total
    discount_amount = round(eligible_amount * promo_percent / 100.0, 2)
    amount = round(max(0.0, subtotal - discount_amount), 2)
    if not math.isfinite(payment_amount) or payment_amount < 0 or payment_amount > amount:
        return jsonify({"ok": False, "error": "Payment amount must be a finite value between ৳0 and the discounted booking total."}), 400

    try:
        reference = make_booking_reference()
    except RuntimeError as exc:
        return jsonify({"ok": False, "error": str(exc)}), 503
    booking = Booking(
        reference=reference,
        customer_name=str(data["customer_name"]).strip()[:120],
        email=email[:180], phone=str(data["phone"]).strip()[:50],
        address=str(data.get("address", "")).strip()[:1000], setup_id=setup.id, setup_name=setup.name,
        booking_date=book_date.isoformat(), start_time=str(data["start_time"]), station_number=station_number,
        duration_minutes=duration, amount=amount, base_amount=base_amount,
        extra_controllers=extra_controllers, controller_fee=controller_fee,
        food_items_json=json.dumps(food_lines, ensure_ascii=False), food_total=food_total,
        pass_id=selected_pass.id if selected_pass else None,
        pass_name=selected_pass.name if selected_pass else "", pass_amount=pass_amount,
        discount_percent=promo_percent if discount_amount > 0 else 0,
        discount_amount=discount_amount,
        payment_method=payment_method, payment_amount=payment_amount, payment_txn_id=payment_txn_id,
        payment_status="unverified" if payment_amount > 0 else "unpaid",
        notes=str(data.get("notes", "")).strip()[:1000], status="pending",
    )
    db.session.add(booking)
    try:
        db.session.commit()
    except Exception:
        db.session.rollback()
        return jsonify({"ok": False, "error": "Booking could not be saved just now. Please retry; do not submit payment twice."}), 503
    return jsonify({"ok": True, "reference": reference, "amount": amount, "subtotal": subtotal,
                    "discount_amount": discount_amount, "discount_percent": booking.discount_percent,
                    "pass_name": booking.pass_name, "pass_amount": pass_amount,
                    "payment_amount": payment_amount, "status": "pending", "payment_status": booking.payment_status,
                    "message": "Your booking request was submitted. Keep the reference code to check its status."}), 201


@app.get("/api/bookings/track")
def track_booking():
    reference = re.sub(r"\s+", "", str(request.args.get("reference", ""))).upper()
    if not reference or len(reference) > 24:
        return jsonify({"ok": False, "error": "Enter your booking reference code."}), 400
    booking = Booking.query.filter_by(reference=reference).first()
    if not booking:
        return jsonify({"ok": False, "error": "No booking was found for that reference. Check the code and try again."}), 404
    try:
        food_items = json.loads(booking.food_items_json or "[]")
    except (ValueError, TypeError):
        food_items = []
    return jsonify({"ok": True, "booking": {
        "reference": booking.reference, "customer_name": booking.customer_name,
        "setup_name": booking.setup_name, "station_number": booking.station_number,
        "booking_date": booking.booking_date, "start_time": booking.start_time,
        "duration_minutes": booking.duration_minutes, "amount": booking.amount,
        "base_amount": booking.base_amount, "extra_controllers": booking.extra_controllers,
        "controller_fee": booking.controller_fee, "food_items": food_items,
        "food_total": booking.food_total, "pass_name": booking.pass_name, "pass_amount": booking.pass_amount,
        "discount_percent": booking.discount_percent, "discount_amount": booking.discount_amount,
        "payment_method": booking.payment_method,
        "payment_amount": booking.payment_amount, "payment_status": booking.payment_status,
        "status": booking.status,
    }})


@app.post("/api/admin/login")
def admin_login():
    data = request.get_json(silent=True) or {}
    entered = str(data.get("password", ""))
    expected = os.environ.get("ADMIN_PASSWORD", "admin1234")
    if secrets.compare_digest(entered, expected):
        session.clear()
        session["is_admin"] = True
        return jsonify({"ok": True})
    return jsonify({"ok": False, "error": "Incorrect password."}), 401


@app.post("/api/admin/logout")
@admin_required
def admin_logout():
    session.clear()
    return jsonify({"ok": True})


@app.get("/api/admin/data")
@admin_required
def admin_data():
    bookings = Booking.query.order_by(desc(Booking.created_at)).limit(500).all()
    return jsonify({"ok": True, "settings": site_settings(),
                    "setups": [setup_dict(s) for s in GameSetup.query.order_by(GameSetup.id).all()],
                    "menu": [menu_dict(m) for m in MenuItem.query.order_by(MenuItem.category, MenuItem.name).all()],
                    "passes": [pass_dict(p) for p in ComboPass.query.order_by(ComboPass.id).all()],
                    "bookings": [booking_dict(b) for b in bookings]})


@app.post("/api/admin/settings")
@admin_required
def save_settings():
    data = request.get_json(silent=True) or {}
    allowed = set(DEFAULT_SETTINGS.keys())
    for key, value in data.items():
        if key not in allowed:
            continue
        value = str(value).strip()
        if key in ("logo_image", "hero_image", "hero_game_one", "hero_game_two") and not valid_image_value(value):
            return jsonify({"ok": False, "error": f"Invalid image for {key}. Use an upload, image URL or bundled image."}), 400
        if key in ("brand_name", "tagline", "hero_subtitle", "location", "address", "phone", "email", "bkash_number", "nagad_number", "footer_note", "hero_game_one_label", "hero_game_two_label", "promo_title") and len(value) > 500:
            return jsonify({"ok": False, "error": f"The {key.replace('_', ' ')} field is too long."}), 400
        if key == "promo_enabled" and value.upper() not in ("YES", "NO"):
            return jsonify({"ok": False, "error": "Promotion status must be YES or NO."}), 400
        if key == "promo_percent":
            try:
                promo_value = float(value)
            except (ValueError, TypeError):
                return jsonify({"ok": False, "error": "Promo discount must be a number between 0 and 100."}), 400
            if not math.isfinite(promo_value) or promo_value < 0 or promo_value > 100:
                return jsonify({"ok": False, "error": "Promo discount must be between 0 and 100 percent."}), 400
            value = str(round(promo_value, 2))
        if key == "promo_scope" and value not in ("all", "session", "pass", "extras"):
            return jsonify({"ok": False, "error": "Choose a valid promo scope."}), 400
        if key == "promo_enabled":
            value = value.upper()
        put_setting(key, value)
    opening = data.get("open_time")
    closing = data.get("close_time")
    if opening and closing:
        op = time_to_minutes(str(opening))
        cl = time_to_minutes(str(closing), closing=True)
        if op is None or cl is None or cl <= op:
            db.session.rollback()
            return jsonify({"ok": False, "error": "Closing time must be after opening time. Use 00:00 for midnight."}), 400
    db.session.commit()
    return jsonify({"ok": True, "message": "Settings saved."})


def parse_prices(raw):
    prices = {}
    for part in str(raw).split(","):
        if not part.strip():
            continue
        if "=" not in part:
            raise ValueError("Use format: minutes=price, for example 30=150,60=220")
        duration, amount = part.split("=", 1)
        duration = int(duration.strip())
        amount = float(amount.strip())
        if duration < 15 or duration > 720 or amount < 0:
            raise ValueError("Session minutes must be 15–720 and prices cannot be negative.")
        prices[str(duration)] = round(amount, 2)
    if not prices:
        raise ValueError("Add at least one duration and price.")
    return prices


@app.post("/api/admin/setups")
@admin_required
def save_setup():
    data = request.get_json(silent=True) or {}
    try:
        name = str(data.get("name", "")).strip()
        if not name:
            raise ValueError("Setup name is required.")
        image_url = str(data.get("image_url", "")).strip()
        if not valid_image_value(image_url):
            raise ValueError("Choose an uploaded image or a valid image URL.")
        prices = data.get("prices")
        if isinstance(prices, dict):
            prices = {str(int(k)): round(float(v), 2) for k, v in prices.items()}
            if not prices:
                raise ValueError("Add at least one duration price.")
        else:
            prices = parse_prices(data.get("prices_text", ""))
        capacity = int(data.get("capacity", 1))
        if capacity < 1 or capacity > 100:
            raise ValueError("Station capacity must be between 1 and 100.")
        setup_id = data.get("id")
        setup = db.session.get(GameSetup, int(setup_id)) if setup_id else GameSetup()
        if setup is None:
            raise ValueError("That gaming setup no longer exists.")
        setup.name = name[:120]
        setup.description = str(data.get("description", "")).strip()[:1000]
        setup.prices_json = json.dumps(prices)
        setup.image_url = image_url
        setup.capacity = capacity
        setup.active = bool(data.get("active", True))
        setup.coming_soon = bool(data.get("coming_soon", False))
        db.session.add(setup)
        db.session.commit()
        return jsonify({"ok": True, "message": "Gaming setup saved.", "setup": setup_dict(setup)})
    except (ValueError, TypeError) as exc:
        db.session.rollback()
        return jsonify({"ok": False, "error": str(exc)}), 400


@app.delete("/api/admin/setups/<int:item_id>")
@admin_required
def delete_setup(item_id):
    setup = db.session.get(GameSetup, item_id)
    if not setup:
        return jsonify({"ok": False, "error": "Setup not found."}), 404
    if Booking.query.filter_by(setup_id=setup.id).first():
        setup.active = False
        db.session.commit()
        return jsonify({"ok": True, "message": "Setup has old bookings, so it was hidden instead of deleted."})
    db.session.delete(setup)
    db.session.commit()
    return jsonify({"ok": True, "message": "Setup deleted."})


@app.post("/api/admin/menu")
@admin_required
def save_menu_item():
    data = request.get_json(silent=True) or {}
    try:
        name = str(data.get("name", "")).strip()
        if not name:
            raise ValueError("Menu item name is required.")
        price = float(data.get("price", 0))
        if price < 0 or price > 10_000_000:
            raise ValueError("Enter a valid price.")
        image_url = str(data.get("image_url", "")).strip()
        if not valid_image_value(image_url):
            raise ValueError("Choose an uploaded image or a valid image URL.")
        item_id = data.get("id")
        item = db.session.get(MenuItem, int(item_id)) if item_id else MenuItem()
        if item is None:
            raise ValueError("That menu item no longer exists.")
        item.name = name[:120]
        item.category = str(data.get("category", "Snacks")).strip()[:60] or "Snacks"
        item.description = str(data.get("description", "")).strip()[:1000]
        item.price = round(price, 2)
        item.image_url = image_url
        item.active = bool(data.get("active", True))
        db.session.add(item)
        db.session.commit()
        return jsonify({"ok": True, "message": "Menu item saved.", "item": menu_dict(item)})
    except (ValueError, TypeError) as exc:
        db.session.rollback()
        return jsonify({"ok": False, "error": str(exc)}), 400


@app.delete("/api/admin/menu/<int:item_id>")
@admin_required
def delete_menu_item(item_id):
    item = db.session.get(MenuItem, item_id)
    if not item:
        return jsonify({"ok": False, "error": "Menu item not found."}), 404
    db.session.delete(item)
    db.session.commit()
    return jsonify({"ok": True, "message": "Menu item deleted."})


@app.post("/api/admin/passes")
@admin_required
def save_combo_pass():
    data = request.get_json(silent=True) or {}
    try:
        name = str(data.get("name", "")).strip()
        if not name:
            raise ValueError("Combo pass name is required.")
        price = float(data.get("price", 0))
        original_price = float(data.get("original_price", 0))
        if price < 0 or original_price < 0 or price > 10_000_000 or original_price > 10_000_000:
            raise ValueError("Enter valid pass prices.")
        item_id = data.get("id")
        combo = db.session.get(ComboPass, int(item_id)) if item_id else ComboPass()
        if combo is None:
            raise ValueError("That combo pass no longer exists.")
        combo.name = name[:120]
        combo.subtitle = str(data.get("subtitle", "")).strip()[:240]
        combo.details = str(data.get("details", "")).strip()[:3000]
        combo.price = round(price, 2)
        combo.original_price = round(original_price, 2)
        combo.active = bool(data.get("active", True))
        db.session.add(combo)
        db.session.commit()
        return jsonify({"ok": True, "message": "Combo pass saved.", "pass": pass_dict(combo)})
    except (ValueError, TypeError) as exc:
        db.session.rollback()
        return jsonify({"ok": False, "error": str(exc)}), 400


@app.delete("/api/admin/passes/<int:item_id>")
@admin_required
def delete_combo_pass(item_id):
    combo = db.session.get(ComboPass, item_id)
    if not combo:
        return jsonify({"ok": False, "error": "Combo pass not found."}), 404
    db.session.delete(combo)
    db.session.commit()
    return jsonify({"ok": True, "message": "Combo pass deleted."})


@app.post("/api/admin/bookings/<int:booking_id>")
@admin_required
def update_booking(booking_id):
    booking = db.session.get(Booking, booking_id)
    if not booking:
        return jsonify({"ok": False, "error": "Booking not found."}), 404
    data = request.get_json(silent=True) or {}
    status = str(data.get("status", booking.status))
    payment_status = str(data.get("payment_status", booking.payment_status))
    if status not in ("pending", "confirmed", "rejected", "cancelled"):
        return jsonify({"ok": False, "error": "Invalid booking status."}), 400
    if payment_status not in ("unpaid", "unverified", "verified"):
        return jsonify({"ok": False, "error": "Invalid payment verification status."}), 400
    if payment_status == "verified" and booking.payment_amount <= 0:
        return jsonify({"ok": False, "error": "This booking has no reported payment amount to verify."}), 400
    if status == "confirmed" and booking.setup_id:
        setup = db.session.get(GameSetup, booking.setup_id)
        if setup:
            proposed_start = time_to_minutes(booking.start_time)
            proposed_end = proposed_start + booking.duration_minutes
            active_bookings = Booking.query.filter(
                Booking.id != booking.id,
                Booking.setup_id == setup.id,
                Booking.station_number == booking.station_number,
                Booking.booking_date == booking.booking_date,
                Booking.status.in_(["pending", "confirmed"]),
            ).all()
            for existing in active_bookings:
                other_start = time_to_minutes(existing.start_time)
                if other_start is not None and proposed_start < other_start + existing.duration_minutes and proposed_end > other_start:
                    return jsonify({"ok": False, "error": "Cannot confirm: this station's time is already reserved by another booking."}), 409
    booking.status = status
    booking.payment_status = payment_status
    db.session.commit()
    return jsonify({"ok": True, "message": "Booking and payment status updated."})


@app.errorhandler(413)
def file_too_large(_error):
    return jsonify({"ok": False, "error": "Upload is too large. Choose a smaller image."}), 413


@app.get("/health")
def health():
    return jsonify({"status": "ok"})


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=int(os.environ.get("PORT", "5000")), debug=True)
