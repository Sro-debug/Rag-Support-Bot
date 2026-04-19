from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    chroma_url: str = "http://chromadb:8000"
    ollama_url: str = "http://ollama:11434"
    chat_model: str = "llama3"
    embed_model: str = "nomic-embed-text"
    collection_name: str = "support_docs"
    chunk_size: int = 500
    chunk_overlap: int = 50
    top_k: int = 5
    min_score: float = 0.3

    class Config:
        env_file = ".env"


settings = Settings()
