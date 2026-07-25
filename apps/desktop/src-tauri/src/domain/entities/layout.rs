use crate::shared::AppError;

/// All supported canvas layout templates — exhaustive, no silent fallback.
/// All match arms in `render_frame` and `build_filter_complex` are exhaustive on this.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Layout {
    Spotify,
    Split,
    Minimal,
    FullBg,
    Karaoke,
    Brand,
}

impl TryFrom<&str> for Layout {
    type Error = AppError;

    fn try_from(s: &str) -> Result<Self, Self::Error> {
        match s {
            "spotify" => Ok(Self::Spotify),
            "split"   => Ok(Self::Split),
            "minimal" => Ok(Self::Minimal),
            "fullbg"  => Ok(Self::FullBg),
            "karaoke" => Ok(Self::Karaoke),
            "brand"   => Ok(Self::Brand),
            other     => Err(AppError::InvalidLayout(other.to_string())),
        }
    }
}

impl TryFrom<String> for Layout {
    type Error = AppError;
    fn try_from(s: String) -> Result<Self, Self::Error> {
        Self::try_from(s.as_str())
    }
}
