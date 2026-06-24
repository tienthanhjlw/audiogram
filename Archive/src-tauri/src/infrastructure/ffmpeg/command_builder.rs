use std::{ffi::OsString, path::PathBuf, process::Command};

/// Fluent builder for FFmpeg CLI invocations.
///
/// Each method appends arguments and returns `self` for chaining.
/// Call `.build()` to produce a ready-to-spawn `Command`.
pub struct FfmpegCommandBuilder {
    ffmpeg: PathBuf,
    args: Vec<OsString>,
}

impl FfmpegCommandBuilder {
    pub fn new(ffmpeg: PathBuf) -> Self {
        Self { ffmpeg, args: Vec::new() }
    }

    fn arg(mut self, s: impl Into<OsString>) -> Self {
        self.args.push(s.into());
        self
    }

    /// `-y -f rawvideo -pixel_format rgba -video_size WxH -r FPS -i pipe:0`
    pub fn input_rawvideo(self, w: u32, h: u32, fps: u32) -> Self {
        self.arg("-y")
            .arg("-f").arg("rawvideo")
            .arg("-pixel_format").arg("rgba")
            .arg("-video_size").arg(format!("{w}x{h}"))
            .arg("-r").arg(fps.to_string())
            .arg("-i").arg("pipe:0")
    }

    /// `-i <path>`
    pub fn input_audio(self, path: &str) -> Self {
        self.arg("-i").arg(path)
    }

    /// `-filter_complex <fc>`
    pub fn filter_complex(self, fc: String) -> Self {
        self.arg("-filter_complex").arg(fc)
    }

    /// `-map [vout] -map 1:a`
    pub fn map_outputs(self) -> Self {
        self.arg("-map").arg("[vout]").arg("-map").arg("1:a")
    }

    /// `-c:v libx264 -preset <preset> -crf <crf> -pix_fmt yuv420p`
    pub fn output_h264(self, crf: u32, preset: &str) -> Self {
        self.arg("-c:v").arg("libx264")
            .arg("-preset").arg(preset)
            .arg("-crf").arg(crf.to_string())
            .arg("-pix_fmt").arg("yuv420p")
    }

    /// `-c:a aac -b:a <bitrate>`
    pub fn output_aac(self, bitrate: &str) -> Self {
        self.arg("-c:a").arg("aac").arg("-b:a").arg(bitrate)
    }

    /// `-movflags +faststart -shortest`
    pub fn faststart_shortest(self) -> Self {
        self.arg("-movflags").arg("+faststart").arg("-shortest")
    }

    /// Output file path.
    pub fn output(self, path: &std::path::Path) -> Self {
        self.arg(path.as_os_str())
    }

    pub fn build(self) -> Command {
        let mut cmd = Command::new(&self.ffmpeg);
        cmd.args(self.args);
        cmd
    }
}
