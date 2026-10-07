---
title: SnapFind — AI Photo Finder for Events
emoji: 📸
colorFrom: violet
colorTo: fuchsia
sdk: docker
app_port: 7860
pinned: false
---

# SnapFind — AI Photo Finder for Events

A Samaro-style web app for event photographers. The photographer uploads event
photos, shares a QR code, guests check in with a selfie, and local AI finds
every photo they appear in. **100% free and open-source: no paid APIs, no SaaS,
no Cloudinary.**

## How it works

```
Photographer                          Guest
     │                                   │
     │  1. Uploads event photos          │
     │     → saved to backend/static     │
     │     → RetinaFace detects faces    │
     │     → ArcFace embeddings stored   │
     │                                   │
     │  2. Gets QR code for the event    │
     │ ─────────── QR ──────────────────▶│ 3. Scans → signup/login
     │                                   │ 4. Uploads a selfie ("Face ID")
     │                                   │ 5. Cosine similarity matches the
     │                                   │    selfie against event photos
     │                                   │ 6. Personal gallery: view,
     │                                      download, delete matches
```

## Tech stack

| Layer    | Choice | Why |
|----------|--------|-----|
| Frontend | Next.js 14 (Pages Router), Tailwind CSS | Fast, familiar React |
| Landing  | Three.js via `@react-three/fiber` + `@react-three/drei` | 3D hero section |
| Backend  | Python Flask + Flask-SQLAlchemy | Simple, readable API |
| Database | SQLite | Zero setup, file-based |
| Storage  | Local filesystem (`backend/static/…`) | No Cloudinary / S3 |
| Face AI  | **DeepFace**: RetinaFace detection → ArcFace embeddings → cosine distance | Free, local, CPU |

## Project structure

```
samaro-clone/
├── README.md
├── backend/
│   ├── app.py            # Flask API (auth, events, photos, matching)
│   ├── face_engine.py    # DeepFace pipeline: RetinaFace + ArcFace + cosine
│   ├── models.py         # User, Event, Photo (SQLAlchemy)
│   ├── config.py         # Env-driven config
│   ├── requirements.txt
│   ├── .env.example
│   └── static/           # created at runtime
│       ├── uploads/<event-slug>/   # event photos
│       ├── qrcodes/<slug>.png      # per-event QR codes
│       └── selfies/                # guest selfies
└── frontend/
    ├── pages/            # index, login, signup, join/[slug], admin, gallery
    ├── components/       # Navbar, Hero3D, UploadDropzone, Lightbox
    ├── lib/api.js        # typed API client
    └── styles/globals.css
```

## Setup

### 1. Backend

```bash
cd backend
python -m venv .venv && source .venv/bin/activate   # Windows: .venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env        # optional — defaults work out of the box
python app.py              # → http://localhost:5000
```

> **First run note:** the first face-AI call downloads the ArcFace + RetinaFace
> weights (free, one-time, a few hundred MB) into `~/.deepface`. The
> `/api/health` endpoint reports `face_ai.available`. Embedding is CPU-based —
> expect a few seconds per photo on first upload.

Default admin (photographer) account, created automatically on startup:

- Email: `admin@example.com`
- Password: `admin123`

Change via `ADMIN_EMAIL` / `ADMIN_PASSWORD` in `.env`.

### 2. Frontend

```bash
cd frontend
cp .env.local.example .env.local   # NEXT_PUBLIC_API_URL=http://localhost:5000
npm install
npm run dev                        # → http://localhost:3000
```

## Usage walkthrough

1. **Photographer:** log in at `/login` as the admin → **Photographer Studio**
   (`/admin`) → create an event → a QR code + shareable link
   (`/join/<event-slug>`) is generated.
2. Upload the event photos for that event. Each photo is scanned locally;
   the UI shows how many faces were detected per photo. Hover a photo to
   **edit** it (rotate/flip, re-scans faces automatically) or delete it.
   The **Users** tab lists every account — grant or revoke access with one
   tap (revoked users can't sign in).
3. **Guest:** scans the QR → signs up → uploads a selfie as their Face ID.
4. The guest opens **My Gallery** (`/gallery`), enters the event code, and
   sees only their matched photos with a match-score badge. They can view,
   download, or delete their own photos.

## API reference

| Method | Route | Auth | Description |
|--------|-------|------|-------------|
| GET | `/api/health` | – | Status + face-AI availability |
| POST | `/api/auth/signup` | – | `{name,phone,email,password}` (validated) → `{token,user}` |
| POST | `/api/auth/login` | – | `{email,password}` → `{token,user}` |
| GET | `/api/auth/me` | Bearer | Current user |
| GET | `/api/events/<slug>` | – | Public event info (for the join page) |
| POST | `/api/admin/events` | Admin | Create event → `{event}` incl. `qr_url`, `join_url` |
| GET | `/api/admin/events` | Admin | List own events |
| DELETE | `/api/admin/events/<id>` | Admin | Delete event + files |
| POST | `/api/admin/events/<id>/photos` | Admin | Multipart `files[]` → face-indexed photos |
| GET | `/api/admin/events/<id>/photos` | Admin | List photos |
| DELETE | `/api/admin/photos/<id>` | Admin | Delete a photo |
| PUT | `/api/admin/photos/<id>` | Admin | Multipart `file` replaces the photo image, re-runs face detection |
| GET | `/api/admin/users` | Admin | List all users (for access control) |
| PATCH | `/api/admin/users/<id>` | Admin | `{is_active}` — grant/revoke a user's access |
| POST | `/api/guest/selfie` | Bearer | Multipart `selfie` → stores Face ID embedding |
| GET | `/api/guest/matches?event=<slug>` | Bearer | Matched photos with `score` |
| GET | `/api/guest/download/<id>` | Bearer | Download a matched photo |
| DELETE | `/api/guest/photos/<id>` | Bearer | Guest deletes a photo they matched |

## Tuning face matching

`FACE_MATCH_THRESHOLD` (default `0.60`) is the max cosine **distance** for a
match — lower is stricter. DeepFace's own default for ArcFace+cosine is 0.68.
If guests miss photos they're in, raise it slightly (e.g. `0.65`); if strangers
match, lower it (e.g. `0.50`).

## Production notes

- Run Flask behind gunicorn: `gunicorn app:app -w 2 --timeout 300`
  (face embedding can take seconds per photo on CPU).
- For real workloads, move embedding to a background worker (RQ/Celery) so
  uploads return instantly; the schema already stores `faces_detected`.
- Serve over HTTPS and put the `static/` folder behind your web server.
- SQLite is fine for hundreds of events; switch `DATABASE_URL` to Postgres
  for serious scale.

## Troubleshooting

- **`deepface` install is heavy** — it pulls TensorFlow. Use Python 3.9–3.11
  and expect a large download. No dlib / Haar cascades needed.
- **No faces detected** — RetinaFace needs reasonably clear faces; the selfie
  endpoint returns 422 with a helpful message if none is found.
- **Port conflicts** — backend `:5000`, frontend `:3000`; change via
  `BACKEND_URL`/`FRONTEND_URL` and `NEXT_PUBLIC_API_URL`.

## Deploy — public link anyone can open (free)

The app ships as **one Docker container**: the Next.js site is statically
exported and served by Flask itself, so the website, API and face AI share
a single port and a single public URL. QR codes and share links are derived
from the request host automatically.

**Hugging Face Spaces (recommended, free, no credit card):**

1. Create a free account at huggingface.co and a **New Space** → choose the
   **Docker** SDK → set the port to `7860`.
2. Push this folder to the Space repo:
   ```bash
   git clone https://huggingface.co/spaces/<your-username>/<space-name>
   cp -r samaro-clone/* <space-name>/   # Dockerfile must be at repo root
   cd <space-name> && git add . && git commit -m "SnapFind" && git push
   ```
3. The Space builds (~10 min first time: TensorFlow + model weights) and
   your app is live at `https://<your-username>-<space-name>.hf.space`.

First-visit notes: the admin account is created from `ADMIN_EMAIL` /
`ADMIN_PASSWORD` (set them as Space **Secrets** to change the defaults);
the ArcFace + RetinaFace weights download once into the Space disk.

**Any Docker host** works the same way:
```bash
docker build -t snapfind .
docker run -p 7860:7860 -e ADMIN_PASSWORD='pick-something-strong' snapfind
```

## License

MIT — free for commercial and personal use.
