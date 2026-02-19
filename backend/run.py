from app import create_app

app = create_app()


if __name__ == "__main__":
    # For local development (non-Docker), you can run:
    #   python run.py
    app.run(host="0.0.0.0", port=5000, debug=True)

