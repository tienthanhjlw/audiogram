use std::{fs, path::PathBuf};
use crate::{
    domain::entities::Segment,
    shared::AppError,
};
use super::util::{format_srt_time, wrap_srt_line};

pub struct SrtWriter;

impl SrtWriter {
    /// Write `segments` to a `.srt` file in the system temp dir; return the path.
    pub fn write(segments: &[Segment]) -> Result<PathBuf, AppError> {
        let tmp = subtitle_dir().join("subtitles.srt");
        fs::create_dir_all(tmp.parent().unwrap())?;

        let mut out = String::new();
        for seg in segments {
            out.push_str(&format!(
                "{}\n{} --> {}\n{}\n\n",
                seg.id + 1,
                format_srt_time(seg.start),
                format_srt_time(seg.end),
                wrap_srt_line(seg.text.trim()),
            ));
        }
        fs::write(&tmp, out)
            .map_err(|e| AppError::Subtitle(format!("write srt: {e}")))?;
        Ok(tmp)
    }
}

pub fn subtitle_dir() -> PathBuf {
    std::env::temp_dir().join("audiogram_whisper")
}
