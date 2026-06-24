use tauri::AppHandle;

use crate::{
    domain::entities::ModelInfo,
    infrastructure::whisper::model_repo::ModelRepository,
    shared::AppError,
};

pub struct ModelService;

impl ModelService {
    pub fn list(app: AppHandle) -> Vec<ModelInfo> {
        ModelRepository::new(app).list()
    }

    pub fn download(app: AppHandle, name: String) -> Result<(), AppError> {
        ModelRepository::new(app).download(&name)
    }

    pub fn seed_bundled(app: &AppHandle) {
        ModelRepository::new(app.clone()).seed_bundled();
    }
}
