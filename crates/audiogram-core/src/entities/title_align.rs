use crate::AppError;

/// Title text horizontal alignment — mirrors apps/desktop's store `titleAlign`
/// union (`'left' | 'center' | 'right'`, design.slice.ts). Exhaustive — no
/// silent fallback, same convention as `Layout`/`WaveStyle`.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Default)]
pub enum TitleAlign {
    Left,
    #[default]
    Center,
    Right,
}

impl TryFrom<&str> for TitleAlign {
    type Error = AppError;

    fn try_from(s: &str) -> Result<Self, Self::Error> {
        match s {
            "left" => Ok(Self::Left),
            "center" => Ok(Self::Center),
            "right" => Ok(Self::Right),
            other => Err(AppError::InvalidTitleAlign(other.to_string())),
        }
    }
}
