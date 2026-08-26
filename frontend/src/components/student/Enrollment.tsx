import { useCallback, useEffect, useRef, useState } from "react";
import { Card, Button, Steps, Alert, Tag, Typography, message, Result } from "antd";
import { CameraOutlined, PlayCircleOutlined, VideoCameraOutlined, CheckCircleOutlined } from "@ant-design/icons";
import api from "@/utils/api";
import type { EkycEnrollResponse } from "@/types";
import { useAuthStore } from "@/stores/authStore";

const { Title, Text } = Typography;

// =============================================================================
// Student: Face eKYC Enrollment — POST /api/v1/ekyc/enroll-initial (§2.2)
// =============================================================================

export function Enrollment() {
  const user = useAuthStore((s) => s.user)!;
  const videoRef = useRef<HTMLVideoElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  const [cameraActive, setCameraActive] = useState(false);
  const [recording, setRecording] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const [recordedBlob, setRecordedBlob] = useState<Blob | null>(null);
  const [enrolled, setEnrolled] = useState(user.isFaceEnrolled);

  // Start camera
  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: 1280, height: 720, facingMode: "user" },
        audio: false,
      });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      setCameraActive(true);
      setCurrentStep(1);
    } catch {
      message.error("Không thể truy cập camera. Vui lòng cấp quyền.");
    }
  };

  const stopCamera = useCallback(() => {
    if (videoRef.current?.srcObject) {
      (videoRef.current.srcObject as MediaStream).getTracks().forEach((t) => t.stop());
      videoRef.current.srcObject = null;
    }
    setCameraActive(false);
  }, []);

  // Record 3s video
  const startRecording = () => {
    if (!videoRef.current?.srcObject) return;
    chunksRef.current = [];
    const recorder = new MediaRecorder(videoRef.current.srcObject as MediaStream, {
      mimeType: "video/webm;codecs=vp9",
    });
    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) chunksRef.current.push(e.data);
    };
    recorder.onstop = () => {
      const blob = new Blob(chunksRef.current, { type: "video/webm" });
      setRecordedBlob(blob);
      setCurrentStep(2);
    };
    mediaRecorderRef.current = recorder;
    recorder.start();
    setRecording(true);

    // Auto stop after 3 seconds
    setTimeout(() => {
      if (recorder.state === "recording") {
        recorder.stop();
        setRecording(false);
      }
    }, 3000);
  };

  // Submit video to eKYC endpoint
  const submitVideo = async () => {
    if (!recordedBlob) return;
    setSubmitting(true);
    try {
      const formData = new FormData();
      formData.append("video_file", recordedBlob, "ekyc-enrollment.webm");

      const result = await api.post("/ekyc/enroll-initial", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      }) as unknown as EkycEnrollResponse;

      setEnrolled(true);
      setCurrentStep(3);
      stopCamera();
      // Update user store
      useAuthStore.getState().setUser({ ...user, isFaceEnrolled: true });
      message.success(`Xác thực khuôn mặt thành công! Match Score: ${result.matchScore}%`);
    } catch (err) {
      message.error(err instanceof Error ? err.message : "Đăng ký thất bại.");
    } finally {
      setSubmitting(false);
    }
  };

  // Cleanup
  useEffect(() => {
    return () => stopCamera();
  }, [stopCamera]);

  // Already enrolled
  if (enrolled) {
    return (
      <Card>
        <Result
          status="success"
          icon={<CheckCircleOutlined style={{ color: "#10b981" }} />}
          title="Hồ sơ sinh trắc học đã xác thực"
          subTitle="Khuôn mặt của bạn đang hoạt động trên toàn bộ hệ thống camera lớp học. Nếu cần cập nhật, vui lòng gửi đơn Re-eKYC tại tab Hồ sơ sinh trắc."
          extra={<Tag color="success">Đã đăng ký</Tag>}
        />
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Card
        title="Đăng ký khuôn mặt eKYC"
        extra={<Tag color="blue">AI Biometric</Tag>}
      >
        <Text type="secondary" className="block mb-4">
          Quay video 3 giây để hệ thống AI trích xuất vector khuôn mặt và xác thực người thật (Liveness Detection).
        </Text>

        {/* Steps */}
        <Steps
          current={currentStep}
          className="mb-6"
          items={[
            { title: "Bật camera" },
            { title: "Quay video 3s" },
            { title: "Xác thực AI" },
            { title: "Hoàn tất" },
          ]}
        />

        {/* Camera View */}
        <div className="relative bg-black rounded-xl overflow-hidden mb-4" style={{ maxWidth: 640, aspectRatio: "16/9" }}>
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            style={{ width: "100%", height: "100%", objectFit: "cover", transform: "scaleX(-1)" }}
          />
          {recording && (
            <div className="absolute top-3 right-3">
              <Tag color="red" className="animate-pulse">🔴 Đang quay...</Tag>
            </div>
          )}
          {/* Face guide ellipse */}
          {cameraActive && (
            <div
              className="absolute inset-0 flex items-center justify-center pointer-events-none"
              style={{
                background: "transparent",
              }}
            >
              <div
                style={{
                  width: 200,
                  height: 260,
                  border: "3px dashed rgba(37, 99, 235, 0.6)",
                  borderRadius: "50%",
                }}
              />
            </div>
          )}
        </div>

        {/* Controls */}
        <div className="flex gap-3 flex-wrap">
          <Button
            icon={<VideoCameraOutlined />}
            onClick={cameraActive ? stopCamera : startCamera}
            disabled={submitting}
          >
            {cameraActive ? "Tắt camera" : "Bật camera"}
          </Button>

          {cameraActive && !recordedBlob && (
            <Button
              type="primary"
              icon={<PlayCircleOutlined />}
              onClick={startRecording}
              disabled={recording || submitting}
              loading={recording}
            >
              {recording ? "Đang quay 3s..." : "Bắt đầu quay video"}
            </Button>
          )}

          {recordedBlob && (
            <Button
              type="primary"
              icon={<CameraOutlined />}
              onClick={submitVideo}
              loading={submitting}
            >
              {submitting ? "Đang xử lý AI..." : "Gửi xác thực khuôn mặt"}
            </Button>
          )}
        </div>

        <Alert
          type="info"
          showIcon
          className="mt-4"
          message={
            currentStep === 0
              ? "Bấm Bật camera để bắt đầu quy trình đăng ký khuôn mặt."
              : currentStep === 1
              ? "Nhìn thẳng vào camera, giữ khuôn mặt trong khung elip, rồi bấm Quay video."
              : currentStep === 2
              ? "Video đã được ghi. Bấm Gửi xác thực để AI phân tích Liveness + trích xuất vector."
              : "Xác thực hoàn tất!"
          }
        />
      </Card>
    </div>
  );
}
