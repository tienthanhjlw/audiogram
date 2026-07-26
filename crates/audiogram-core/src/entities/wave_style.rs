use crate::AppError;

/// All supported waveform visual styles — exhaustive, no silent fallback.
/// `effect_for(WaveStyle)` in infrastructure has a compile-checked match on this.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum WaveStyle {
    Bar,
    Line,
    Mirror,
    Dot,
    Neon,
    Orb,
    Pulse,
    Eq,
    Player,
}

impl TryFrom<&str> for WaveStyle {
    type Error = AppError;

    fn try_from(s: &str) -> Result<Self, Self::Error> {
        match s {
            "bar"    => Ok(Self::Bar),
            "line"   => Ok(Self::Line),
            "mirror" => Ok(Self::Mirror),
            "dot"    => Ok(Self::Dot),
            "neon"   => Ok(Self::Neon),
            "orb"    => Ok(Self::Orb),
            "pulse"  => Ok(Self::Pulse),
            "eq"     => Ok(Self::Eq),
            "player" => Ok(Self::Player),
            other    => Err(AppError::InvalidWaveStyle(other.to_string())),
        }
    }
}

impl TryFrom<String> for WaveStyle {
    type Error = AppError;
    fn try_from(s: String) -> Result<Self, Self::Error> {
        Self::try_from(s.as_str())
    }
}
