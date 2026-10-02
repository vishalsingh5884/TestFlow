import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import * as tf from "@tensorflow/tfjs";
import * as blazeface from "@tensorflow-models/blazeface";
import * as cocoSsd from "@tensorflow-models/coco-ssd";
import "./StudentTest.css";

function ExamIcon({
  name,
  size = 20,
  strokeWidth = 1.9,
  className = "",
}) {
  const commonProps = {
    width: size,
    height: size,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth,
    strokeLinecap: "round",
    strokeLinejoin: "round",
    "aria-hidden": "true",
    focusable: "false",
    className,
    style: {
      display: "inline-block",
      verticalAlign: "middle",
      flexShrink: 0,
    },
  };

  switch (name) {
    case "camera":
      return (
        <svg {...commonProps}>
          <path d="M4 7.5h3l1.4-2h7.2l1.4 2H20a2 2 0 0 1 2 2v7a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2Z" />
          <circle cx="12" cy="13" r="3.4" />
        </svg>
      );
    case "microphone":
      return (
        <svg {...commonProps}>
          <rect x="8" y="3" width="8" height="12" rx="4" />
          <path d="M5 11.5a7 7 0 0 0 14 0M12 18.5V21M9 21h6" />
        </svg>
      );
    case "fullscreen":
      return (
        <svg {...commonProps}>
          <path d="M8 3H3v5M16 3h5v5M21 16v5h-5M8 21H3v-5" />
        </svg>
      );
    case "sparkles":
      return (
        <svg {...commonProps}>
          <path d="m12 3 1.25 4.75L18 9l-4.75 1.25L12 15l-1.25-4.75L6 9l4.75-1.25L12 3Z" />
          <path d="m19 14 .65 2.35L22 17l-2.35.65L19 20l-.65-2.35L16 17l2.35-.65L19 14Z" />
          <path d="m5 14 .55 1.95L7.5 16.5l-1.95.55L5 19l-.55-1.95L2.5 16.5l1.95-.55L5 14Z" />
        </svg>
      );
    case "lock":
      return (
        <svg {...commonProps}>
          <rect x="5" y="10" width="14" height="11" rx="2" />
          <path d="M8 10V7a4 4 0 0 1 8 0v3" />
        </svg>
      );
    case "arrow-right":
      return (
        <svg {...commonProps}>
          <path d="M5 12h13" />
          <path d="m13 6 6 6-6 6" />
        </svg>
      );
    case "arrow-left":
      return (
        <svg {...commonProps}>
          <path d="M19 12H6" />
          <path d="m11 6-6 6 6 6" />
        </svg>
      );
    case "check":
      return (
        <svg {...commonProps}>
          <path d="m5 12 4 4L19 6" />
        </svg>
      );
    case "clock":
      return (
        <svg {...commonProps}>
          <circle cx="12" cy="12" r="9" />
          <path d="M12 7v5l3 2" />
        </svg>
      );
    case "alert":
      return (
        <svg {...commonProps}>
          <path d="m12 3 9 16H3L12 3Z" />
          <path d="M12 9v4M12 16h.01" />
        </svg>
      );
    case "help":
      return (
        <svg {...commonProps}>
          <circle cx="12" cy="12" r="9" />
          <path d="M9.6 9a2.5 2.5 0 1 1 3.95 2.05c-.9.62-1.55 1.02-1.55 2.45" />
          <path d="M12 17h.01" />
        </svg>
      );
    case "eye":
      return (
        <svg {...commonProps}>
          <path d="M2.5 12s3.5-6 9.5-6 9.5 6 9.5 6-3.5 6-9.5 6-9.5-6-9.5-6Z" />
          <circle cx="12" cy="12" r="2.7" />
        </svg>
      );
    case "user":
      return (
        <svg {...commonProps}>
          <circle cx="12" cy="8" r="4" />
          <path d="M6 21v-2a4 4 0 0 1 4-4h4a4 4 0 0 1 4 4v2" />
        </svg>
      );
    case "users":
      return (
        <svg {...commonProps}>
          <circle cx="9" cy="8" r="3" />
          <path d="M3.5 20a5.5 5.5 0 0 1 11 0" />
          <path d="M16 5.5a3 3 0 0 1 0 5.8M18 14a5.3 5.3 0 0 1 3 6" />
        </svg>
      );
    case "smartphone":
      return (
        <svg {...commonProps}>
          <rect x="7" y="2.5" width="10" height="19" rx="2" />
          <path d="M10 5h4M11 18.5h2" />
        </svg>
      );
    case "laptop":
      return (
        <svg {...commonProps}>
          <rect x="5" y="4" width="14" height="11" rx="1.5" />
          <path d="M3 19h18M7 19l1.2-2h7.6l1.2 2" />
        </svg>
      );
    case "volume":
      return (
        <svg {...commonProps}>
          <path d="M4 10h3l4-3v10l-4-3H4z" />
          <path d="M15 9.5a3.5 3.5 0 0 1 0 5M17.5 7a7 7 0 0 1 0 10" />
        </svg>
      );
    case "shield-check":
      return (
        <svg {...commonProps}>
          <path d="M12 3 19 6v5.5c0 4.4-2.8 7.8-7 9.5-4.2-1.7-7-5.1-7-9.5V6l7-3Z" />
          <path d="m8.5 12 2.2 2.2 4.8-5" />
        </svg>
      );
    case "shield":
      return (
        <svg {...commonProps}>
          <path d="M12 3 19 6v5.5c0 4.4-2.8 7.8-7 9.5-4.2-1.7-7-5.1-7-9.5V6l7-3Z" />
        </svg>
      );
    default:
      return null;
  }
}

const API_BASE = (
  import.meta.env.VITE_API_URL ||
  "http://localhost:5000"
).replace(/\/$/, "");

const STUDENT_TOKEN_KEYS = [
  "studentToken",
  "student_token",
  "token",
  "authToken",
  "accessToken",
];

const ATTEMPT_KEYS = [
  "attemptId",
  "studentAttemptId",
  "examAttemptId",
];

function getStoredToken() {
  for (const key of STUDENT_TOKEN_KEYS) {
    const localValue = localStorage.getItem(key);
    if (localValue) return localValue;

    const sessionValue = sessionStorage.getItem(key);
    if (sessionValue) return sessionValue;
  }

  return "";
}

function getStoredAttemptId() {
  for (const key of ATTEMPT_KEYS) {
    const value = localStorage.getItem(key);
    if (value) return value;
  }

  return "";
}

function getQuestionKey(question, fallbackIndex) {
  if (!question) return String(fallbackIndex);

  const rawKey =
    question.id ??
    question._id ??
    question.questionId ??
    question.number ??
    fallbackIndex;

  return String(rawKey);
}

function normalizeQuestions(test) {
  if (!test) return [];

  if (Array.isArray(test.questions)) {
    return test.questions;
  }

  if (Array.isArray(test.test?.questions)) {
    return test.test.questions;
  }

  if (Array.isArray(test.paper?.questions)) {
    return test.paper.questions;
  }

  return [];
}

function normalizeTest(test) {
  const source =
    test?.test ||
    test?.paper ||
    test ||
    {};

  return {
    ...source,
    subject:
      source.subject ||
      "Online Examination",

    paperId:
      source.paperId ||
      source.paperID ||
      source.id ||
      "TEST",

    duration: Number(
      source.duration ||
        source.durationMinutes ||
        source.timeLimit ||
        30
    ),
  };
}

function formatTime(totalSeconds) {
  const seconds = Math.max(
    0,
    Number(totalSeconds) || 0
  );

  const hours = Math.floor(
    seconds / 3600
  );

  const minutes = Math.floor(
    (seconds % 3600) / 60
  );

  const remaining = seconds % 60;

  if (hours > 0) {
    return `${String(hours).padStart(
      2,
      "0"
    )}:${String(minutes).padStart(
      2,
      "0"
    )}:${String(remaining).padStart(
      2,
      "0"
    )}`;
  }

  return `${String(minutes).padStart(
    2,
    "0"
  )}:${String(remaining).padStart(
    2,
    "0"
  )}`;
}

function getQuestionTypeLabel(question) {
  const type = String(
    question?.type ||
      question?.questionType ||
      "MCQ"
  ).toLowerCase();

  if (
    type.includes("coding") ||
    type.includes("code")
  ) {
    return "CODING";
  }

  if (
    type.includes("true") ||
    type.includes("false")
  ) {
    return "TRUE / FALSE";
  }

  return "MULTIPLE CHOICE";
}

function isCodingQuestion(question) {
  const type = String(
    question?.type ||
      question?.questionType ||
      ""
  ).toLowerCase();

  return (
    type.includes("coding") ||
    type.includes("code")
  );
}

function getAnswerValue(answers, question, fallbackIndex) {
  if (!question) return "";

  const key = getQuestionKey(question, fallbackIndex);
  return answers[key] ?? "";
}

function createViolation(type, message) {
  return {
    id: `${type}-${Date.now()}-${Math.random()
      .toString(36)
      .slice(2)}`,
    violationType: type,
    message,
    timestamp:
      new Date().toISOString(),
  };
}

function getFaceBox(face) {
  if (!face) return null;

  if (
    Array.isArray(face.topLeft) &&
    Array.isArray(face.bottomRight)
  ) {
    return {
      left: Number(face.topLeft[0]),
      top: Number(face.topLeft[1]),
      right: Number(
        face.bottomRight[0]
      ),
      bottom: Number(
        face.bottomRight[1]
      ),
    };
  }

  if (Array.isArray(face.box)) {
    return {
      left: Number(face.box[0]),
      top: Number(face.box[1]),
      right:
        Number(face.box[0]) +
        Number(face.box[2]),
      bottom:
        Number(face.box[1]) +
        Number(face.box[3]),
    };
  }

  return null;
}

function estimateLookingAway(
  face,
  width,
  height
) {
  const box = getFaceBox(face);

  if (
    !box ||
    !width ||
    !height
  ) {
    return false;
  }

  const faceWidth =
    box.right - box.left;

  const faceHeight =
    box.bottom - box.top;

  if (
    faceWidth <= 0 ||
    faceHeight <= 0
  ) {
    return false;
  }

  const centerX =
    (box.left + box.right) / 2;

  const centerY =
    (box.top + box.bottom) / 2;

  const normalizedX =
    centerX / width;

  const normalizedY =
    centerY / height;

  const horizontalAway =
    Math.abs(
      normalizedX - 0.5
    ) > 0.45;

  const verticalAway =
    Math.abs(
      normalizedY - 0.5
    ) > 0.48;

  return (
    horizontalAway ||
    verticalAway
  );
}

export default function StudentTest(
  props
) {
  const {
    test: incomingTest,
    paper,
    onBackToDashboard,
    onComplete,
    onSubmit,
    onTestSubmitted,
    requestMediaPermissions:
      externalRequestMediaPermissions,
    startExamAttempt:
      externalStartExamAttempt,
  } = props;

  const rawTest =
    incomingTest ||
    paper ||
    props;

  const test = useMemo(
    () =>
      normalizeTest(rawTest),
    [rawTest]
  );

  const initialQuestions =
    useMemo(
      () =>
        normalizeQuestions(
          rawTest
        ),
      [rawTest]
    );

  const [
    questions,
    setQuestions,
  ] = useState(
    initialQuestions
  );

  const [
    currentQuestion,
    setCurrentQuestion,
  ] = useState(0);

  const [
    answers,
    setAnswers,
  ] = useState({});

  const [
    timeLeft,
    setTimeLeft,
  ] = useState(
    Math.max(
      1,
      Number(
        test.duration || 30
      )
    ) * 60
  );

  const [
    screen,
    setScreen,
  ] = useState(
    "permissions"
  );

  const [
    startingExam,
    setStartingExam,
  ] = useState(false);

  const [
    submitting,
    setSubmitting,
  ] = useState(false);

  const [
    cameraPermission,
    setCameraPermission,
  ] = useState(false);

  const [
    microphonePermission,
    setMicrophonePermission,
  ] = useState(false);

  const [
    mediaChecking,
    setMediaChecking,
  ] = useState(false);

  const [
    mediaError,
    setMediaError,
  ] = useState("");

  const [
    error,
    setError,
  ] = useState("");

  const [
    modelStatus,
    setModelStatus,
  ] = useState("WAITING");

  const [
    proctorEnabled,
    setProctorEnabled,
  ] = useState(false);

  const [
    proctorLoading,
    setProctorLoading,
  ] = useState(false);

  const [
    proctorError,
    setProctorError,
  ] = useState("");

  const [
    faceStatus,
    setFaceStatus,
  ] = useState("WAITING");

  const [
    faceCount,
    setFaceCount,
  ] = useState(0);

  const [
    faceWarningCount,
    setFaceWarningCount,
  ] = useState(0);

  const [
    faceWarningMessage,
    setFaceWarningMessage,
  ] = useState("");

  const [
    personCount,
    setPersonCount,
  ] = useState(0);

  const [
    lookingAway,
    setLookingAway,
  ] = useState(false);

  const [
    phoneDetected,
    setPhoneDetected,
  ] = useState(false);

  const [
    deviceCount,
    setDeviceCount,
  ] = useState(0);

  const [
    speakingDetected,
    setSpeakingDetected,
  ] = useState(false);

  const [
    additionalPersonDetected,
    setAdditionalPersonDetected,
  ] = useState(false);

  const [
    proctorRisk,
    setProctorRisk,
  ] = useState("LOW");

  const [
    violationCount,
    setViolationCount,
  ] = useState(0);

  const [
    voiceViolationCount,
    setVoiceViolationCount,
  ] = useState(0);

  const [
    recentViolations,
    setRecentViolations,
  ] = useState([]);

  const [
    examTerminated,
    setExamTerminated,
  ] = useState(false);

  const [
    terminationReason,
    setTerminationReason,
  ] = useState("");

  const [
    terminationType,
    setTerminationType,
  ] = useState(
    "SECURITY_VIOLATION"
  );

  const [
    showSubmitModal,
    setShowSubmitModal,
  ] = useState(false);

  const [
    attemptId,
    setAttemptId,
  ] = useState(
    getStoredAttemptId()
  );

  const videoElementRef =
    useRef(null);

  const proctorVideoRef =
    useRef(null);

  const streamRef =
    useRef(null);

  const audioContextRef =
    useRef(null);

  const analyserRef =
    useRef(null);

  const animationFrameRef =
    useRef(null);

  const audioVoiceStateRef =
    useRef({
      voiceStartedAt: 0,
      lastVoiceAt: 0,
      noiseFloor: 0.01,
      speaking: false,
    });

  const voiceEpisodeRef =
    useRef(false);

  const faceModelRef =
    useRef(null);

  const objectModelRef =
    useRef(null);

  const faceDetectionIntervalRef =
    useRef(null);

  const objectDetectionIntervalRef =
    useRef(null);

  const mountedRef =
    useRef(true);

  const examStartedRef =
    useRef(false);

  const terminatingRef =
    useRef(false);

  const submittedRef =
    useRef(false);

  const detectionBusyRef =
    useRef(false);

  const mediaReadyRef =
    useRef(false);

  const cameraReadyRef =
    useRef(false);

  const microphoneReadyRef =
    useRef(false);

  const securityTerminationRef =
    useRef(false);

  const multipleFaceFramesRef =
    useRef(0);

  const noFaceSinceRef =
    useRef(0);

  const noFaceWarningCountRef =
    useRef(0);

  const phoneFramesRef =
    useRef(0);

  const voiceViolationLockRef =
    useRef(false);

  const multipleFaceEvidenceRef =
    useRef(0);

  const speechRecognitionRef =
    useRef(null);

  const speechRecognitionActiveRef =
    useRef(false);

  const speechLastResultAtRef =
    useRef(0);

  const speechEpisodeRef =
    useRef(false);

  const getHeaders =
    useCallback(() => {
      const token =
        getStoredToken();

      return {
        "Content-Type":
          "application/json",

        ...(token
          ? {
              Authorization: `Bearer ${token}`,
            }
          : {}),
      };
    }, []);

  const apiRequest =
    useCallback(
      async (
        path,
        options = {}
      ) => {
        const response =
          await fetch(
            `${API_BASE}${path}`,
            {
              ...options,
              headers: {
                ...getHeaders(),
                ...(options.headers ||
                  {}),
              },
            }
          );

        let data = null;

        try {
          data =
            await response.json();
        } catch {
          data = null;
        }

        if (!response.ok) {
          throw new Error(
            data?.message ||
              `Request failed with status ${response.status}`
          );
        }

        return data;
      },
      [getHeaders]
    );

  useEffect(() => {
    mountedRef.current =
      true;

    return () => {
      mountedRef.current =
        false;
    };
  }, []);

  useEffect(() => {
    setQuestions(
      normalizeQuestions(
        rawTest
      )
    );
  }, [rawTest]);

  const exitFullscreen =
    useCallback(
      async () => {
        try {
          if (
            document.fullscreenElement
          ) {
            await document.exitFullscreen();
          }
        } catch {}
      },
      []
    );

  const stopMedia =
    useCallback(() => {
      if (streamRef.current) {
        streamRef.current
          .getTracks()
          .forEach(
            (track) => {
              try {
                track.stop();
              } catch {}
            }
          );

        streamRef.current =
          null;
      }

      if (
        videoElementRef.current
      ) {
        videoElementRef.current.srcObject =
          null;
      }

      if (
        proctorVideoRef.current
      ) {
        proctorVideoRef.current.srcObject =
          null;
      }

      if (
        animationFrameRef.current
      ) {
        cancelAnimationFrame(
          animationFrameRef.current
        );

        animationFrameRef.current =
          null;
      }

      if (
        faceDetectionIntervalRef.current
      ) {
        clearInterval(
          faceDetectionIntervalRef.current
        );

        faceDetectionIntervalRef.current =
          null;
      }

      if (
        objectDetectionIntervalRef.current
      ) {
        clearInterval(
          objectDetectionIntervalRef.current
        );

        objectDetectionIntervalRef.current =
          null;
      }

      if (
        audioContextRef.current
      ) {
        try {
          audioContextRef.current.close();
        } catch {}

        audioContextRef.current =
          null;
      }

      analyserRef.current =
        null;

      audioVoiceStateRef.current =
        {
          voiceStartedAt: 0,
          lastVoiceAt: 0,
          noiseFloor: 0.0025,
          speaking: false,
        };

      voiceEpisodeRef.current =
        false;

      voiceViolationLockRef.current =
        false;

      multipleFaceFramesRef.current =
        0;

      multipleFaceEvidenceRef.current =
        0;

      noFaceSinceRef.current =
        0;

      noFaceWarningCountRef.current =
        0;

      speechLastResultAtRef.current =
        0;

      speechEpisodeRef.current =
        false;

      speechRecognitionActiveRef.current =
        false;

      if (speechRecognitionRef.current) {
        try {
          speechRecognitionRef.current.onend = null;
          speechRecognitionRef.current.onerror = null;
          speechRecognitionRef.current.onresult = null;
          speechRecognitionRef.current.stop();
        } catch {}
        speechRecognitionRef.current = null;
      }

      phoneFramesRef.current =
        0;

      detectionBusyRef.current =
        false;

      mediaReadyRef.current =
        false;

      cameraReadyRef.current =
        false;

      microphoneReadyRef.current =
        false;
    }, []);

  useEffect(() => {
    return () => {
      stopMedia();
    };
  }, [stopMedia]);

  const requestMediaPermissions =
    useCallback(
      async () => {
        if (mediaChecking) {
          return false;
        }

        setMediaChecking(true);
        setMediaError("");
        setError("");

        try {
          if (
            externalRequestMediaPermissions
          ) {
            const result =
              await externalRequestMediaPermissions();

            if (result === false) {
              throw new Error(
                "Camera and microphone permissions were not granted."
              );
            }

            setCameraPermission(
              true
            );

            setMicrophonePermission(
              true
            );

            setScreen(
              "ai-check"
            );

            return true;
          }

          if (
            !navigator.mediaDevices ||
            !navigator.mediaDevices
              .getUserMedia
          ) {
            throw new Error(
              "Your browser does not support camera and microphone access."
            );
          }

          stopMedia();

          const stream =
            await navigator.mediaDevices.getUserMedia(
              {
                video: {
                  facingMode:
                    "user",

                  width: {
                    ideal: 1280,
                  },

                  height: {
                    ideal: 720,
                  },

                  frameRate: {
                    ideal: 30,
                    max: 30,
                  },
                },

                audio: {
                  echoCancellation:
                    false,

                  noiseSuppression:
                    false,

                  autoGainControl:
                    false,

                  channelCount: 1,

                  sampleRate: 48000,
                },
              }
            );

          const videoTracks =
            stream.getVideoTracks();

          const audioTracks =
            stream.getAudioTracks();

          if (
            videoTracks.length === 0
          ) {
            throw new Error(
              "Camera access was not granted."
            );
          }

          if (
            audioTracks.length === 0
          ) {
            throw new Error(
              "Microphone access was not granted."
            );
          }

          streamRef.current =
            stream;

          cameraReadyRef.current =
            true;

          microphoneReadyRef.current =
            true;

          mediaReadyRef.current =
            true;

          setCameraPermission(
            true
          );

          setMicrophonePermission(
            true
          );

          if (
            videoElementRef.current
          ) {
            videoElementRef.current.srcObject =
              stream;

            try {
              await videoElementRef.current.play();
            } catch {}
          }

          if (
            proctorVideoRef.current
          ) {
            proctorVideoRef.current.srcObject =
              stream;

            try {
              await proctorVideoRef.current.play();
            } catch {}
          }

          setScreen(
            "ai-check"
          );

          return true;
        } catch (requestError) {
          setCameraPermission(
            false
          );

          setMicrophonePermission(
            false
          );

          setMediaError(
            requestError?.message ||
              "Camera and microphone permissions could not be granted."
          );

          return false;
        } finally {
          if (
            mountedRef.current
          ) {
            setMediaChecking(
              false
            );
          }
        }
      },
      [
        externalRequestMediaPermissions,
        mediaChecking,
        stopMedia,
      ]
    );

  const loadProctorModels =
    useCallback(
      async () => {
        if (
          faceModelRef.current &&
          objectModelRef.current
        ) {
          setModelStatus(
            "READY"
          );

          return true;
        }

        setModelStatus(
          "LOADING"
        );

        try {
          await tf.ready();

          if (
            !faceModelRef.current
          ) {
            faceModelRef.current =
              await blazeface.load();
          }

          if (
            !objectModelRef.current
          ) {
            objectModelRef.current =
              await cocoSsd.load({
                base: "lite_mobilenet_v2",
              });
          }

          setModelStatus(
            "READY"
          );

          return true;
        } catch (modelError) {
          console.error(
            modelError
          );

          setModelStatus(
            "FAILED"
          );

          throw new Error(
            "AI vision models could not be loaded."
          );
        }
      },
      []
    );

  const startAudioMonitoring =
    useCallback(() => {
      if (
        !streamRef.current ||
        audioContextRef.current
      ) {
        return;
      }

      const AudioContextClass =
        window.AudioContext ||
        window.webkitAudioContext;

      if (!AudioContextClass) {
        return;
      }

      try {
        const context =
          new AudioContextClass();

        const source =
          context.createMediaStreamSource(
            streamRef.current
          );

        const highPass =
          context.createBiquadFilter();
        highPass.type = "highpass";
        highPass.frequency.value = 85;

        const lowPass =
          context.createBiquadFilter();
        lowPass.type = "lowpass";
        lowPass.frequency.value = 5000;

        const analyser =
          context.createAnalyser();
        analyser.fftSize = 4096;
        analyser.smoothingTimeConstant = 0.55;
        analyser.minDecibels = -100;
        analyser.maxDecibels = -5;

        source.connect(highPass);
        highPass.connect(lowPass);
        lowPass.connect(analyser);

        audioContextRef.current = context;
        analyserRef.current = analyser;

        const timeData =
          new Float32Array(analyser.fftSize);

        const calculateRms = () => {
          let sum = 0;

          for (
            let i = 0;
            i < timeData.length;
            i += 1
          ) {
            const value =
              timeData[i];

            sum +=
              value * value;
          }

          return Math.sqrt(
            sum / timeData.length
          );
        };

        const monitor = () => {
          if (
            !mountedRef.current ||
            !analyserRef.current ||
            !examStartedRef.current ||
            submittedRef.current ||
            examTerminated
          ) {
            return;
          }

          analyser.getFloatTimeDomainData(timeData);

          const rms = calculateRms();
          const state = audioVoiceStateRef.current;
          const now = performance.now();

          if (!state.speaking && state.voiceStartedAt === 0) {
            state.noiseFloor =
              state.noiseFloor * 0.992 + rms * 0.008;
          }

          const floor = Math.max(
            state.noiseFloor,
            0.0018
          );

          const quietVoice =
            rms >= Math.max(
              0.0032,
              floor * 1.18
            );

          const normalVoice =
            rms >= Math.max(
              0.0048,
              floor * 1.30
            );

          const analyserVoice =
            quietVoice ||
            normalVoice;

          const recognitionVoice =
            now -
              speechLastResultAtRef.current <=
            1500;

          if (
            analyserVoice ||
            recognitionVoice
          ) {
            if (state.voiceStartedAt === 0) {
              state.voiceStartedAt = now;
            }

            state.lastVoiceAt = now;

            if (
              recognitionVoice ||
              now -
                state.voiceStartedAt >=
              300
            ) {
              state.speaking = true;
            }
          } else if (
            state.speaking &&
            now -
              state.lastVoiceAt >=
            700
          ) {
            state.speaking = false;
            state.voiceStartedAt = 0;
          } else if (
            !state.speaking &&
            state.voiceStartedAt !== 0 &&
            now -
              state.lastVoiceAt >=
            250
          ) {
            state.voiceStartedAt = 0;
          }

          setSpeakingDetected(
            state.speaking
          );

          animationFrameRef.current =
            requestAnimationFrame(monitor);
        };

        if (context.state === "suspended") {
          context.resume().catch(() => {});
        }

        monitor();

        const SpeechRecognitionClass =
          window.SpeechRecognition ||
          window.webkitSpeechRecognition;

        if (SpeechRecognitionClass) {
          try {
            const recognition =
              new SpeechRecognitionClass();

            recognition.continuous = true;
            recognition.interimResults = true;
            recognition.lang = "en-IN";
            recognition.maxAlternatives = 1;

            recognition.onresult = (event) => {
              if (
                !examStartedRef.current ||
                submittedRef.current ||
                examTerminated
              ) {
                return;
              }

              let hasSpeech = false;

              for (
                let i = event.resultIndex;
                i < event.results.length;
                i += 1
              ) {
                const result = event.results[i];
                const transcript =
                  result?.[0]?.transcript?.trim() || "";

                if (transcript.length >= 2) {
                  hasSpeech = true;
                  break;
                }
              }

              if (hasSpeech) {
                speechEpisodeRef.current = true;

                speechLastResultAtRef.current =
                  performance.now();

                audioVoiceStateRef.current.lastVoiceAt =
                  performance.now();

                audioVoiceStateRef.current.speaking =
                  true;

                setSpeakingDetected(
                  true
                );
              }
            };

            recognition.onerror = (event) => {
              console.debug(
                "Speech recognition status:",
                event?.error || "unknown"
              );
            };

            recognition.onend = () => {
              speechRecognitionActiveRef.current = false;

              if (
                examStartedRef.current &&
                !submittedRef.current &&
                !examTerminated
              ) {
                try {
                  recognition.start();
                  speechRecognitionActiveRef.current = true;
                } catch {}
              }
            };

            speechRecognitionRef.current = recognition;
            recognition.start();
            speechRecognitionActiveRef.current = true;
          } catch (speechError) {
            console.debug(
              "Speech recognition unavailable:",
              speechError
            );
          }
        }
      } catch (audioError) {
        console.warn(
          "Audio monitoring error:",
          audioError
        );
      }
    }, [examTerminated]);

  const terminateExam =
    useCallback(
      async (
        reason,
        violationType = "SECURITY_VIOLATION"
      ) => {
        if (
          terminatingRef.current ||
          submittedRef.current ||
          securityTerminationRef.current
        ) {
          return;
        }

        securityTerminationRef.current =
          true;

        terminatingRef.current =
          true;

        examStartedRef.current =
          false;

        setExamTerminated(
          true
        );

        setTerminationReason(
          reason
        );

        setTerminationType(
          violationType
        );

        setProctorRisk(
          "HIGH"
        );

        setScreen(
          "terminated"
        );

        const violation =
          createViolation(
            violationType,
            reason
          );

        setViolationCount(
          (value) =>
            value + 1
        );

        setRecentViolations(
          (previous) =>
            [
              violation,
              ...previous,
            ].slice(0, 10)
        );

        stopMedia();

        await exitFullscreen();

        try {
          if (attemptId) {
            await apiRequest(
              `/api/student/tests/${encodeURIComponent(
                test.paperId
              )}/violation`,
              {
                method:
                  "POST",

                body: JSON.stringify({
                  attemptId,
                  violationType,
                  message: reason,
                }),
              }
            );
          }
        } catch (apiError) {
          console.warn(
            "Unable to save violation:",
            apiError
          );
        }

        terminatingRef.current =
          false;
      },
      [
        apiRequest,
        attemptId,
        exitFullscreen,
        stopMedia,
        test.paperId,
      ]
    );

  const runFaceDetection =
    useCallback(
      async () => {
        const video =
          proctorVideoRef.current;
        const model =
          faceModelRef.current;

        if (
          !video ||
          !model ||
          video.readyState < 2 ||
          video.videoWidth === 0
        ) {
          return;
        }

        if (
          !examStartedRef.current ||
          examTerminated ||
          submittedRef.current
        ) {
          return;
        }

        try {
          const predictions =
            await model.estimateFaces(
              video,
              false
            );

          const rawFaces = Array.isArray(predictions)
            ? predictions
            : [];

          const width = video.videoWidth;
          const height = video.videoHeight;

          const candidateFaces = rawFaces
            .map((face) => {
              const box = getFaceBox(face);
              const probabilityValue =
                Array.isArray(face?.probability)
                  ? Number(face.probability[0])
                  : Number(face?.probability ?? 0);

              if (!box) return null;

              const boxWidth = box.right - box.left;
              const boxHeight = box.bottom - box.top;
              const centerX =
                (box.left + box.right) / 2;
              const centerY =
                (box.top + box.bottom) / 2;
              const areaRatio =
                (boxWidth * boxHeight) /
                (width * height);

              const valid =
                probabilityValue >= 0.65 &&
                boxWidth >= Math.max(30, width * 0.03) &&
                boxHeight >= Math.max(30, height * 0.03) &&
                areaRatio >= 0.001;

              if (!valid) return null;

              return {
                face,
                box,
                probability: probabilityValue,
                centerX,
                centerY,
                areaRatio,
              };
            })
            .filter(Boolean)
            .sort(
              (a, b) =>
                b.probability - a.probability
            );

          const distinctFaces = [];
          for (const candidate of candidateFaces) {
            const duplicate = distinctFaces.some(
              (accepted) => {
                const dx =
                  candidate.centerX -
                  accepted.centerX;
                const dy =
                  candidate.centerY -
                  accepted.centerY;
                const distance = Math.sqrt(
                  dx * dx + dy * dy
                );

                const minDimension = Math.min(
                  candidate.box.right - candidate.box.left,
                  candidate.box.bottom - candidate.box.top,
                  accepted.box.right - accepted.box.left,
                  accepted.box.bottom - accepted.box.top
                );

                return (
                  distance < minDimension * 0.55
                );
              }
            );

            if (!duplicate) {
              distinctFaces.push(candidate);
            }
          }

          const count = distinctFaces.length;

          setFaceCount(count);

          if (count >= 2) {
            multipleFaceFramesRef.current += 1;
            multipleFaceEvidenceRef.current += 1;
          } else {
            multipleFaceFramesRef.current = Math.max(
              0,
              multipleFaceFramesRef.current - 1
            );
            multipleFaceEvidenceRef.current = Math.max(
              0,
              multipleFaceEvidenceRef.current - 1
            );
          }

          if (
            multipleFaceFramesRef.current >= 10 &&
            multipleFaceEvidenceRef.current >= 10
          ) {
            setFaceStatus(
              "MULTIPLE FACES"
            );

            setAdditionalPersonDetected(
              true
            );

            await terminateExam(
              "Two or more people were consistently detected in the examination camera. The examination has been terminated.",
              "MULTIPLE_PEOPLE"
            );

            return;
          }

          if (count === 0) {
            const now =
              performance.now();

            setFaceStatus("NO FACE");
            setLookingAway(false);
            setAdditionalPersonDetected(false);

            if (
              noFaceSinceRef.current ===
              0
            ) {
              noFaceSinceRef.current =
                now;
            }

            const noFaceDuration =
              now -
              noFaceSinceRef.current;

            if (
              noFaceDuration >= 6000 &&
              noFaceWarningCountRef.current <
                1
            ) {
              noFaceWarningCountRef.current =
                1;

              setFaceWarningCount(1);
              setFaceWarningMessage(
                "WARNING 1/3: Please keep your face clearly visible in the examination camera."
              );

              setProctorRisk(
                "MEDIUM"
              );

              window.setTimeout(
                () =>
                  setFaceWarningMessage(
                    ""
                  ),
                3000
              );
            }

            if (
              noFaceDuration >= 12000 &&
              noFaceWarningCountRef.current <
                2
            ) {
              noFaceWarningCountRef.current =
                2;

              setFaceWarningCount(2);
              setFaceWarningMessage(
                "WARNING 2/3: Your face is still not visible. Please return to the camera immediately."
              );

              setProctorRisk(
                "HIGH"
              );

              window.setTimeout(
                () =>
                  setFaceWarningMessage(
                    ""
                  ),
                3000
              );
            }

            if (
              noFaceDuration >= 18000 &&
              noFaceWarningCountRef.current <
                3
            ) {
              noFaceWarningCountRef.current =
                3;

              setFaceWarningCount(3);
              setFaceWarningMessage(
                "FINAL WARNING: The examination will be terminated in 7 seconds if your face is not detected."
              );

              setProctorRisk(
                "HIGH"
              );

              window.setTimeout(
                () =>
                  setFaceWarningMessage(
                    ""
                  ),
                3000
              );
            }

            if (
              noFaceDuration >= 25000
            ) {
              await terminateExam(
                "The student's face was not visible in the examination camera after repeated warnings. The examination has been terminated.",
                "FACE_NOT_VISIBLE"
              );

              return;
            }

            return;
          }

          noFaceSinceRef.current =
            0;

          if (
            noFaceWarningCountRef.current ===
            0
          ) {
            setProctorRisk(
              "LOW"
            );
          }

          if (count === 1) {
            setFaceStatus("FACE DETECTED");

            const away =
              estimateLookingAway(
                distinctFaces[0].face,
                width,
                height
              );

            setLookingAway(away);
            setAdditionalPersonDetected(false);
          } else {
            setFaceStatus("CHECKING");
            setAdditionalPersonDetected(false);
          }
        } catch (detectionError) {
          console.warn(
            "Face detection error:",
            detectionError
          );
        }
      },
      [examTerminated, terminateExam]
    );

  const runObjectDetection =
    useCallback(
      async () => {
        const video =
          proctorVideoRef.current;

        const model =
          objectModelRef.current;

        if (
          !video ||
          !model ||
          video.readyState < 2 ||
          video.videoWidth === 0 ||
          detectionBusyRef.current
        ) {
          return;
        }

        if (
          !examStartedRef.current ||
          examTerminated ||
          submittedRef.current
        ) {
          return;
        }

        detectionBusyRef.current =
          true;

        try {
          const predictions =
            await model.detect(
              video,
              30,
              0.30
            );

          const detections =
            Array.isArray(
              predictions
            )
              ? predictions
              : [];

          const phones =
            detections.filter(
              (item) =>
                item.class ===
                  "cell phone" &&
                item.score >=
                  0.45
            );

          const phoneFound =
            phones.length > 0;

          setPhoneDetected(
            phoneFound
          );

          const devices =
            detections.filter(
              (item) =>
                [
                  "cell phone",
                  "laptop",
                  "remote",
                ].includes(
                  item.class
                ) &&
                item.score >=
                  0.35
            );

          setDeviceCount(
            devices.length
          );

          if (phoneFound) {
            phoneFramesRef.current +=
              1;
          } else {
            phoneFramesRef.current =
              Math.max(
                0,
                phoneFramesRef.current -
                  1
              );
          }

          if (
            phoneFramesRef.current >=
            4
          ) {
            await terminateExam(
              "A mobile phone was detected in the examination environment. The examination has been terminated immediately.",
              "PHONE_DETECTED"
            );

            return;
          }
        } catch (detectionError) {
          console.warn(
            "Object detection error:",
            detectionError
          );
        } finally {
          detectionBusyRef.current =
            false;
        }
      },
      [
        examTerminated,
        terminateExam,
      ]
    );

  const startVisionMonitoring =
    useCallback(() => {
      if (
        faceDetectionIntervalRef.current ||
        objectDetectionIntervalRef.current
      ) {
        return;
      }

      faceDetectionIntervalRef.current =
        setInterval(
          runFaceDetection,
          500
        );

      objectDetectionIntervalRef.current =
        setInterval(
          runObjectDetection,
          500
        );

      runFaceDetection();

      runObjectDetection();
    }, [
      runFaceDetection,
      runObjectDetection,
    ]);

  const initializeAIProctor =
    useCallback(
      async () => {
        setProctorLoading(
          true
        );

        setProctorError("");

        try {
          if (
            !mediaReadyRef.current
          ) {
            const ready =
              await requestMediaPermissions();

            if (!ready) {
              throw new Error(
                "Camera and microphone are required."
              );
            }
          }

          if (
            !streamRef.current
          ) {
            throw new Error(
              "Camera stream is unavailable."
            );
          }

          if (
            proctorVideoRef.current
          ) {
            proctorVideoRef.current.srcObject =
              streamRef.current;

            try {
              await proctorVideoRef.current.play();
            } catch {}
          }

          await loadProctorModels();

          multipleFaceFramesRef.current =
            0;

          multipleFaceEvidenceRef.current =
            0;

          noFaceSinceRef.current =
            0;

          noFaceWarningCountRef.current =
            0;

          setFaceWarningCount(0);
          setFaceWarningMessage("");

          phoneFramesRef.current =
            0;

          voiceEpisodeRef.current =
            false;

          voiceViolationLockRef.current =
            false;

          startAudioMonitoring();

          startVisionMonitoring();

          setFaceStatus(
            "WAITING"
          );

          setProctorRisk(
            "LOW"
          );

          setProctorEnabled(
            true
          );

          return true;
        } catch (initializationError) {
          setProctorError(
            initializationError?.message ||
              "AI proctoring failed to initialize."
          );

          setProctorEnabled(
            false
          );

          return false;
        } finally {
          setProctorLoading(
            false
          );
        }
      },
      [
        loadProctorModels,
        requestMediaPermissions,
        startAudioMonitoring,
        startVisionMonitoring,
      ]
    );

  const enterFullscreen =
    useCallback(
      async () => {
        if (
          document.fullscreenElement
        ) {
          return true;
        }

        const root =
          document.documentElement;

        if (
          !root.requestFullscreen
        ) {
          throw new Error(
            "Fullscreen mode is not supported by this browser."
          );
        }

        await root.requestFullscreen();

        return true;
      },
      []
    );

  useEffect(() => {
    const handleFullscreenChange =
      () => {
        if (
          !examStartedRef.current ||
          submittedRef.current ||
          examTerminated
        ) {
          return;
        }

        if (
          !document.fullscreenElement
        ) {
          terminateExam(
            "Fullscreen mode was exited. The examination has been terminated immediately.",
            "FULLSCREEN_EXIT"
          );
        }
      };

    const handleFullscreenError =
      () => {
        if (
          examStartedRef.current &&
          !submittedRef.current
        ) {
          terminateExam(
            "Fullscreen mode could not be maintained. The examination has been terminated.",
            "FULLSCREEN_EXIT"
          );
        }
      };

    document.addEventListener(
      "fullscreenchange",
      handleFullscreenChange
    );

    document.addEventListener(
      "fullscreenerror",
      handleFullscreenError
    );

    return () => {
      document.removeEventListener(
        "fullscreenchange",
        handleFullscreenChange
      );

      document.removeEventListener(
        "fullscreenerror",
        handleFullscreenError
      );
    };
  }, [
    examTerminated,
    terminateExam,
  ]);

  const startExamAttempt =
    useCallback(
      async () => {
        if (
          startingExam ||
          examStartedRef.current
        ) {
          return;
        }

        setStartingExam(true);

        setError("");

        try {
          securityTerminationRef.current =
            false;

          submittedRef.current =
            false;

          await enterFullscreen();

          if (
            externalStartExamAttempt
          ) {
            const result =
              await externalStartExamAttempt();

            if (
              result === false
            ) {
              throw new Error(
                "Unable to start examination."
              );
            }

            const newAttemptId =
              result?.attemptId ||
              result?.attempt
                ?.attemptId ||
              result?.data
                ?.attemptId ||
              "";

            if (
              newAttemptId
            ) {
              setAttemptId(
                newAttemptId
              );

              localStorage.setItem(
                "attemptId",
                newAttemptId
              );
            }
          } else {
            const response =
              await apiRequest(
                `/api/student/tests/${encodeURIComponent(
                  test.paperId
                )}/start`,
                {
                  method:
                    "POST",

                  body: JSON.stringify(
                    {}
                  ),
                }
              );

            const newAttemptId =
              response?.attemptId ||
              response?.attempt
                ?.attemptId ||
              response?.data
                ?.attemptId ||
              "";

            if (
              newAttemptId
            ) {
              setAttemptId(
                newAttemptId
              );

              localStorage.setItem(
                "attemptId",
                newAttemptId
              );
            }
          }

          examStartedRef.current =
            true;

          setExamTerminated(
            false
          );

          setTerminationReason(
            ""
          );

          setTerminationType(
            "SECURITY_VIOLATION"
          );

          setScreen(
            "exam"
          );

          await initializeAIProctor();

        } catch (startError) {
          const message =
            startError?.message ||
            "Unable to start the examination.";

          const lowerMessage =
            message.toLowerCase();

          const cannotReattempt =
            lowerMessage.includes(
              "already completed"
            ) ||
            lowerMessage.includes(
              "already attempted"
            ) ||
            lowerMessage.includes(
              "cannot retake"
            ) ||
            lowerMessage.includes(
              "cannot reattempt"
            ) ||
            lowerMessage.includes(
              "cannot attempt"
            ) ||
            lowerMessage.includes(
              "flagged"
            ) ||
            lowerMessage.includes(
              "terminated"
            ) ||
            lowerMessage.includes(
              "retake"
            );

          if (
            cannotReattempt
          ) {
            examStartedRef.current =
              false;

            stopMedia();

            await exitFullscreen();

            alert(
              "You cannot reattempt this test.\n\n" +
              "This examination has already been " +
              "submitted, terminated, or flagged."
            );

            setError(
              "You cannot reattempt this test."
            );

            return;
          }

          setError(
            message
          );

          examStartedRef.current =
            false;

          stopMedia();

          await exitFullscreen();

        } finally {

          setStartingExam(
            false
          );

        }
      },
      [
        apiRequest,
        enterFullscreen,
        exitFullscreen,
        externalStartExamAttempt,
        initializeAIProctor,
        startingExam,
        stopMedia,
        test.paperId,
      ]
    );

  const answeredCount =
    useMemo(
      () =>
        questions.filter(
          (item, idx) => {
            const value =
              getAnswerValue(
                answers,
                item,
                idx
              );

            return (
              value !==
                undefined &&
              value !== null &&
              String(
                value
              ).trim() !== ""
            );
          }
        ).length,
      [
        answers,
        questions,
      ]
    );

  const handleSubmitTest =
    useCallback(
      async (autoSubmit = false) => {
        if (submitting || submittedRef.current) {
          return;
        }

        const currentAttemptId =
          attemptId ||
          test?.attemptId ||
          getStoredAttemptId();

        const paperId = String(
          test?.paperId ||
            test?.paperID ||
            test?.id ||
            "",
        ).trim();

        if (!paperId) {
          setError("This examination has no valid Paper ID.");
          return;
        }

        if (!currentAttemptId) {
          setError(
            "Your examination attempt could not be found. Please return to the test list and start the test again.",
          );
          setShowSubmitModal(false);
          return;
        }

        if (!Array.isArray(questions) || questions.length === 0) {
          setError("This examination has no questions to submit.");
          return;
        }

        setSubmitting(true);
        setError("");
        setShowSubmitModal(false);

        try {
          const response = await apiRequest(
            `/api/student/tests/${encodeURIComponent(paperId)}/submit`,
            {
              method: "POST",
              body: JSON.stringify({
                attemptId: currentAttemptId,
                answers,
              }),
            },
          );

          const serverResult =
            response?.result ||
            response?.data?.result ||
            response?.data ||
            response;

          submittedRef.current = true;
          examStartedRef.current = false;

          const finalResult = {
            ...serverResult,
            attemptId: serverResult?.attemptId || currentAttemptId,
            paperId,
            subject:
              serverResult?.subject ||
              test.subject ||
              "Online Examination",
            answered: answeredCount,
            totalQuestions:
              Number(serverResult?.totalQuestions) ||
              questions.length,
          };

          localStorage.setItem(
            "last_exam_result",
            JSON.stringify(finalResult),
          );

          for (const key of ATTEMPT_KEYS) {
            localStorage.removeItem(key);
            sessionStorage.removeItem(key);
          }

          stopMedia();
          await exitFullscreen();

          if (typeof onTestSubmitted === "function") {
            onTestSubmitted(finalResult);
          } else if (typeof onSubmit === "function") {
            onSubmit(finalResult);
          } else if (typeof onComplete === "function") {
            onComplete(finalResult);
          } else {
            setScreen("submitted");
          }
        } catch (submitError) {
          console.error("Submit examination error:", submitError);
          setError(
            submitError?.message ||
              "Failed to submit the examination. Please try again.",
          );
          setShowSubmitModal(false);
        } finally {
          if (mountedRef.current) {
            setSubmitting(false);
          }
        }
      },
      [
        apiRequest,
        answeredCount,
        answers,
        attemptId,
        exitFullscreen,
        onComplete,
        onSubmit,
        onTestSubmitted,
        questions.length,
        stopMedia,
        submitting,
        test?.paperId,
        test?.subject,
      ],
    );

  const handleAnswerChange =
    useCallback(
      (value) => {
        const current =
          questions[
            currentQuestion
          ];

        if (!current) {
          return;
        }

        const key = getQuestionKey(current, currentQuestion);

        setAnswers(
          (previous) => ({
            ...previous,
            [key]: value,
          })
        );
      },
      [
        currentQuestion,
        questions,
      ]
    );

  const unansweredCount =
    Math.max(
      0,
      questions.length -
        answeredCount
    );

  const progress =
    questions.length === 0
      ? 0
      : Math.round(
          ((currentQuestion + 1) /
            questions.length) *
            100
        );

  const question =
    questions[
      currentQuestion
    ] || {
      id: "empty",
      question:
        "No question available.",
      options: [],
      difficulty:
        "Medium",
      topic:
        "General",
      type: "mcq",
    };

  useEffect(() => {
    if (
      screen !== "exam" ||
      examTerminated ||
      !examStartedRef.current
    ) {
      return;
    }

    if (!speakingDetected) {
      voiceEpisodeRef.current = false;
      voiceViolationLockRef.current = false;
      return;
    }

    if (
      voiceEpisodeRef.current ||
      voiceViolationLockRef.current
    ) {
      return;
    }

    voiceEpisodeRef.current = true;
    voiceViolationLockRef.current = true;

    const violation = createViolation(
      "AUDIO_ACTIVITY",
      "Sustained voice activity was detected during the examination."
    );

    setVoiceViolationCount((previous) => {
      const next = previous + 1;

      if (
        next >= 3 &&
        !securityTerminationRef.current
      ) {
        setTimeout(() => {
          terminateExam(
            "Three separate voice activity violations were detected during the examination. The examination has been terminated.",
            "VOICE_VIOLATIONS"
          );
        }, 0);
      }

      return next;
    });

    setViolationCount(
      (previous) => previous + 1
    );

    setRecentViolations((previous) => [
      violation,
      ...previous,
    ].slice(0, 10));
  }, [
    screen,
    examTerminated,
    speakingDetected,
    terminateExam,
  ]);

  if (
    screen ===
    "permissions"
  ) {
    return (
      <div className="secure-page">
        <div className="secure-bg" />

        <div className="permission-shell">
          <div className="permission-brand">
            <div className="brand-mark">
              T
            </div>

            <div>
              <strong>
                TESTFLOW
              </strong>

              <span>
                SECURE EXAMINATION
              </span>
            </div>
          </div>

          <div className="permission-card">
            <div className="step-indicator">
              <span className="active">
                01
              </span>

              <i />

              <span>
                02
              </span>

              <i />

              <span>
                03
              </span>
            </div>

            <div className="permission-icon camera-icon">
              <ExamIcon name="camera" size={30} />
            </div>

            <div className="eyebrow">
              BEFORE YOU CONTINUE
            </div>

            <h1>
              Prepare your
              <br />
              examination environment
            </h1>

            <p className="permission-description">
              TESTFLOW uses your camera,
              microphone and fullscreen mode
              to maintain a secure examination
              environment.
            </p>

            <div className="permission-list">
              <div className="permission-item">
                <div className="permission-item-icon">
                  <ExamIcon name="camera" size={20} />
                </div>

                <div>
                  <strong>
                    Camera access
                  </strong>

                  <span>
                    Required for face and
                    environment monitoring
                  </span>
                </div>

                <b className="required">
                  REQUIRED
                </b>
              </div>

              <div className="permission-item">
                <div className="permission-item-icon">
                  <ExamIcon name="microphone" size={20} />
                </div>

                <div>
                  <strong>
                    Microphone access
                  </strong>

                  <span>
                    Used for sustained
                    voice activity monitoring
                  </span>
                </div>

                <b className="required">
                  REQUIRED
                </b>
              </div>

              <div className="permission-item">
                <div className="permission-item-icon">
                  <ExamIcon name="fullscreen" size={20} />
                </div>

                <div>
                  <strong>
                    Fullscreen mode
                  </strong>

                  <span>
                    Required throughout the test
                  </span>
                </div>

                <b className="required">
                  REQUIRED
                </b>
              </div>

              <div className="permission-item">
                <div className="permission-item-icon">
                  <ExamIcon name="sparkles" size={20} />
                </div>

                <div>
                  <strong>
                    AI proctoring
                  </strong>

                  <span>
                    Face, people and device
                    detection
                  </span>
                </div>

                <b className="secure">
                  SECURE
                </b>
              </div>
            </div>

            {mediaError && (
              <div className="secure-error">
                <ExamIcon name="alert" size={18} />
                <strong>
                  Permission required
                </strong>

                <span>
                  {mediaError}
                </span>
              </div>
            )}

            {error && (
              <div className="secure-error">
                <ExamIcon name="alert" size={18} />
                <strong>
                  Unable to continue
                </strong>

                <span>
                  {error}
                </span>
              </div>
            )}

            <button
              className="secure-primary"
              onClick={
                requestMediaPermissions
              }
              disabled={
                mediaChecking
              }
            >
              {mediaChecking
                ? "REQUESTING ACCESS..."
                : "CONTINUE TO TEST"}

              <span>
                <ExamIcon name="arrow-right" size={18} />
              </span>
            </button>

            <button
              className="secure-secondary"
              onClick={
                onBackToDashboard
              }
              disabled={
                mediaChecking
              }
            >
              <ExamIcon name="arrow-left" size={17} /> Back to Dashboard
            </button>
          </div>

          <div className="permission-footer">
            <span>
              <ExamIcon name="lock" size={16} /> Secure Session
            </span>

            <span>
              <ExamIcon name="shield-check" size={15} /> AI Protected
            </span>

            <span>
              <ExamIcon name="lock" size={15} /> Encrypted
            </span>
          </div>
        </div>
      </div>
    );
  }

  if (
    screen ===
    "ai-check"
  ) {
    return (
      <div className="secure-page">
        <div className="secure-bg" />

        <video
          ref={proctorVideoRef}
          autoPlay
          muted
          playsInline
          className="hidden-proctor-video"
        />

        <video
          ref={videoElementRef}
          autoPlay
          muted
          playsInline
          className="hidden-proctor-video"
        />

        <div className="permission-shell">
          <div className="permission-brand">
            <div className="brand-mark">
              T
            </div>

            <div>
              <strong>
                TESTFLOW
              </strong>

              <span>
                AI SECURITY CHECK
              </span>
            </div>
          </div>

          <div className="permission-card">
            <div className="step-indicator">
              <span className="complete">
                <ExamIcon name="check" size={20} />
              </span>

              <i className="complete-line" />

              <span className="active">
                02
              </span>

              <i />

              <span>
                03
              </span>
            </div>

            <div className="permission-icon ai-icon">
              <ExamIcon name="sparkles" size={30} />
            </div>

            <div className="eyebrow">
              SYSTEM CHECK
            </div>

            <h1>
              AI proctor is
              <br />
              ready to initialize
            </h1>

            <p className="permission-description">
              Your camera and microphone are
              connected. The AI vision models
              will now be prepared.
            </p>

            <div className="check-status-list">
              <div className="check-status">
                <span className="check-circle">
                  <ExamIcon name="check" size={20} />
                </span>

                <div>
                  <strong>
                    Camera
                  </strong>

                  <span>
                    Connected
                  </span>
                </div>

                <b>
                  READY
                </b>
              </div>

              <div className="check-status">
                <span className="check-circle">
                  <ExamIcon name="check" size={20} />
                </span>

                <div>
                  <strong>
                    Microphone
                  </strong>

                  <span>
                    Connected
                  </span>
                </div>

                <b>
                  READY
                </b>
              </div>

              <div className="check-status">
                <span
                  className={`check-circle ${
                    modelStatus ===
                    "READY"
                      ? ""
                      : "loading"
                  }`}
                >
                  {modelStatus ===
                  "READY"
                    ? <ExamIcon name="check" size={18} />
                    : <span className="status-bullet" aria-hidden="true" />}
                </span>

                <div>
                  <strong>
                    AI Vision
                  </strong>

                  <span>
                    {modelStatus ===
                    "READY"
                      ? "Face & object models loaded"
                      : "Loading detection models"}
                  </span>
                </div>

                <b>
                  {modelStatus}
                </b>
              </div>
            </div>

            {proctorError && (
              <div className="secure-error">
                <ExamIcon name="alert" size={18} />
                <strong>
                  AI initialization failed
                </strong>

                <span>
                  {proctorError}
                </span>
              </div>
            )}

            <button
              className="secure-primary"
              disabled={
                proctorLoading ||
                startingExam
              }
              onClick={
                startExamAttempt
              }
            >
              {startingExam
                ? "ENTERING SECURE MODE..."
                : proctorLoading
                ? "INITIALIZING AI..."
                : "START SECURE TEST"}

              <span>
                <ExamIcon name="arrow-right" size={18} />
              </span>
            </button>

            <div className="security-note">
              <span>
                <ExamIcon name="shield" size={18} />
              </span>

              <div>
                <strong>
                  Security rules
                </strong>

                <p>
                  A mobile phone or two
                  consistently detected faces
                  will terminate the test.
                  Three separate voice
                  violations will also
                  terminate the test.
                </p>
              </div>
            </div>
          </div>

          <div className="permission-footer">
            <span>
              <ExamIcon name="camera" size={15} /> Camera
            </span>

            <span>
              <ExamIcon name="microphone" size={15} /> Microphone
            </span>

            <span>
              AI {modelStatus}
            </span>
          </div>
        </div>
      </div>
    );
  }

  if (
    screen ===
    "terminated"
  ) {
    const violationLabel =
      terminationType ===
      "PHONE_DETECTED"
        ? "MOBILE PHONE DETECTED"
        : terminationType ===
          "MULTIPLE_PEOPLE"
        ? "MULTIPLE PEOPLE DETECTED"
        : terminationType ===
          "VOICE_VIOLATIONS"
        ? "THREE VOICE VIOLATIONS"
        : terminationType ===
          "FULLSCREEN_EXIT"
        ? "FULLSCREEN EXIT"
        : "SECURITY VIOLATION";

    return (
      <div className="terminated-page">
        <div className="terminated-card">
          <div className="terminated-icon">
            <ExamIcon name="alert" size={30} />
          </div>

          <div className="eyebrow danger">
            SECURITY VIOLATION
          </div>

          <h1>
            Examination
            <br />
            Terminated
          </h1>

          <p>
            {terminationReason ||
              "The examination was terminated because a security violation was detected."}
          </p>

          <div className="termination-details">
            <div>
              <span>
                Attempt
              </span>

              <strong>
                {attemptId ||
                  "ACTIVE"}
              </strong>
            </div>

            <div>
              <span>
                Violation
              </span>

              <strong>
                {violationLabel}
              </strong>
            </div>

            <div>
              <span>
                Status
              </span>

              <strong className="danger-text">
                TERMINATED
              </strong>
            </div>
          </div>

          <button
            className="secure-primary danger-button"
            onClick={async () => {
              await exitFullscreen();
              onBackToDashboard();
            }}
          >
            RETURN TO DASHBOARD

            <span>
              <ExamIcon name="arrow-right" size={18} />
            </span>
          </button>
        </div>
      </div>
    );
  }

  if (
    screen ===
    "submitted"
  ) {
    return (
      <div className="terminated-page submitted-page">
        <div className="terminated-card">
          <div className="success-icon">
            <ExamIcon name="check" size={30} />
          </div>

          <div className="eyebrow success">
            EXAMINATION COMPLETE
          </div>

          <h1>
            Test submitted
            <br />
            successfully
          </h1>

          <p>
            Your answers have been
            submitted successfully.
          </p>

          <button
            className="secure-primary"
            onClick={async () => {
              await exitFullscreen();
              onBackToDashboard();
            }}
          >
            RETURN TO DASHBOARD

            <span>
              <ExamIcon name="arrow-right" size={18} />
            </span>
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="exam-page">
      <video
        ref={videoElementRef}
        autoPlay
        muted
        playsInline
        className="hidden-proctor-video"
      />

      <video
        ref={proctorVideoRef}
        autoPlay
        muted
        playsInline
        className="hidden-proctor-video"
      />

      <header className="exam-header">
        <div className="exam-brand">
          <div className="brand-mark">
            T
          </div>

          <div>
            <strong>
              TESTFLOW
            </strong>

            <span>
              SECURE EXAMINATION
            </span>
          </div>
        </div>

        <div className="exam-title">
          <strong>
            {test.subject}
          </strong>

          <span>
            PAPER ID <span aria-hidden="true">•</span>{" "}
            {test.paperId}
          </span>
        </div>

        <div
          className={`exam-clock ${
            timeLeft <= 60
              ? "danger-clock"
              : ""
          }`}
        >
          <span>
            <ExamIcon name="clock" size={16} /> TIME LEFT
          </span>

          <strong>
            {formatTime(
              timeLeft
            )}
          </strong>
        </div>
      </header>

      <div className="proctor-bar">
        <div className="proctor-live">
          <span />
          <ExamIcon name="shield" size={16} /> AI PROCTOR LIVE
        </div>

        <div>
          <ExamIcon name="eye" size={16} /> Vision

          <strong>
            {modelStatus}
          </strong>
        </div>

        <div>
          <ExamIcon name="user" size={16} /> Face

          <strong>
            {faceStatus}
          </strong>
        </div>

        <div>
          <ExamIcon name="users" size={16} /> People

          <strong>
            {faceCount}
          </strong>
        </div>

        <div>
          <ExamIcon name="alert" size={16} /> Face Warnings

          <strong
            className={
              faceWarningCount >=
              2
                ? "danger-text"
                : faceWarningCount ===
                  1
                ? "warning-text"
                : ""
            }
          >
            {faceWarningCount}/3
          </strong>
        </div>

        <div>
          <ExamIcon name="laptop" size={16} /> Device

          <strong>
            {deviceCount}
          </strong>
        </div>

        <div>
          <ExamIcon name="smartphone" size={16} /> Phone

          <strong
            className={
              phoneDetected
                ? "danger-text"
                : ""
            }
          >
            {phoneDetected
              ? "DETECTED"
              : "CLEAR"}
          </strong>
        </div>

        <div>
          <ExamIcon name="volume" size={16} /> Audio

          <strong
            className={
              speakingDetected
                ? "warning-text"
                : ""
            }
          >
            {speakingDetected
              ? "VOICE"
              : "CLEAR"}
          </strong>
        </div>

        <div>
          <ExamIcon name="alert" size={16} /> Voice Violations

          <strong
            className={
              voiceViolationCount >=
              2
                ? "danger-text"
                : voiceViolationCount >
                  0
                ? "warning-text"
                : ""
            }
          >
            {voiceViolationCount}/3
          </strong>
        </div>

        <div
          className={`risk-pill ${proctorRisk.toLowerCase()}`}
        >
          <ExamIcon name="shield" size={15} /> RISK <span aria-hidden="true">•</span>{" "}
          {proctorRisk}
        </div>
      </div>

      {faceWarningMessage ? (
        <div
          style={{
            margin:
              "10px 18px 0",
            padding:
              "12px 16px",
            borderRadius:
              "12px",
            border:
              "1px solid rgba(255, 180, 0, 0.45)",
            background:
              "rgba(255, 170, 0, 0.10)",
            color:
              "#ffd166",
            fontWeight: 800,
            textAlign:
              "center",
            letterSpacing:
              "0.02em",
          }}
        >
          {faceWarningMessage}
        </div>
      ) : null}

      <div className="exam-progress">
        <div>
          <span>
            QUESTION {" "}
            {currentQuestion +
              1} {" "}
            / {" "}
            {questions.length}
          </span>

          <span>
            {answeredCount} {" "}
            ANSWERED
          </span>
        </div>

        <div className="progress-track">
          <div
            style={{
              width: `${progress}%`,
            }}
          />
        </div>
      </div>

      <main className="exam-content">
        <section className="question-card">
          <div className="question-meta">
            <span>
              QUESTION {" "}
              {String(
                currentQuestion +
                  1
              ).padStart(
                2,
                "0"
              )}
            </span>

            <div>
              <b>
                {getQuestionTypeLabel(
                  question
                )}
              </b>

              <b className="difficulty">
                {question.difficulty ||
                  "Medium"}
              </b>
            </div>
          </div>

          <div className="topic">
            {question.topic ||
              "GENERAL"}
          </div>

          <h1>
            {question.question}
          </h1>

          {isCodingQuestion(
            question
          ) ? (
            <textarea
              className="answer-code"
              value={getAnswerValue(
                answers,
                question,
                currentQuestion
              )}
              onChange={(
                event
              ) =>
                handleAnswerChange(
                  event.target.value
                )
              }
              placeholder="Write your solution here..."
            />
          ) : (
            <div className="answers">
              {(
                question.options ||
                []
              ).map(
                (
                  option,
                  index
                ) => {
                  const selected =
                    getAnswerValue(
                      answers,
                      question,
                      currentQuestion
                    ) ===
                    option;

                  return (
                    <button
                      key={`${getQuestionKey(question, currentQuestion)}-${index}`}
                      className={`answer-option ${
                        selected
                          ? "selected"
                          : ""
                      }`}
                      onClick={() =>
                        handleAnswerChange(
                          option
                        )
                      }
                    >
                      <span>
                        {String.fromCharCode(
                          65 +
                            index
                        )}
                      </span>

                      <strong>
                        {option}
                      </strong>

                      <i>
                        {selected ? (
                          <ExamIcon name="check" size={17} />
                        ) : null}
                      </i>
                    </button>
                  );
                }
              )}
            </div>
          )}

          <div className="question-footer">
            <button
              className="nav-secondary"
              disabled={
                currentQuestion ===
                0
              }
              onClick={() =>
                setCurrentQuestion(
                  (value) =>
                    Math.max(
                      0,
                      value - 1
                    )
                )
              }
            >
              <ExamIcon name="arrow-left" size={17} /> Previous
            </button>

            {currentQuestion ===
            questions.length -
              1 ? (
              <button
                className="submit-button"
                onClick={() =>
                  setShowSubmitModal(
                    true
                  )
                }
              >
                Submit Test <ExamIcon name="check" size={17} />
              </button>
            ) : (
              <button
                className="next-button"
                onClick={() =>
                  setCurrentQuestion(
                    (value) =>
                      Math.min(
                        questions.length -
                          1,
                        value + 1
                      )
                  )
                }
              >
                Next Question <ExamIcon name="arrow-right" size={17} />
              </button>
            )}
          </div>
        </section>

        <aside className="exam-sidebar">
          <div className="sidebar-card">
            <div className="sidebar-heading">
              <div>
                <span>
                  EXAMINATION
                </span>

                <h2>
                  Question Navigator
                </h2>
              </div>

              <strong>
                {answeredCount}/
                {questions.length}
              </strong>
            </div>

            <div className="question-grid">
              {questions.map(
                (
                  item,
                  index
                ) => {
                  const answered =
                    String(
                      getAnswerValue(
                        answers,
                        item,
                        index
                      )
                    ).trim() !==
                    "";

                  return (
                    <button
                      key={
                        getQuestionKey(item, index)
                      }
                      className={`question-number ${
                        index ===
                        currentQuestion
                          ? "current"
                          : ""
                      } ${
                        answered
                          ? "answered"
                          : ""
                      }`}
                      onClick={() =>
                        setCurrentQuestion(
                          index
                        )
                      }
                    >
                      {index + 1}
                    </button>
                  );
                }
              )}
            </div>

            <div className="legend">
              <span>
                <i className="current-dot" />
                Current
              </span>

              <span>
                <i className="answered-dot" />
                Answered
              </span>

              <span>
                <i className="empty-dot" />
                Unanswered
              </span>
            </div>
          </div>

          <div className="sidebar-card security-card">
            <div className="sidebar-heading">
              <div>
                <span>
                  SECURITY
                </span>

                <h2>
                  AI Proctor
                </h2>
              </div>

              <div
                className={`security-status ${proctorRisk.toLowerCase()}`}
              >
                {proctorRisk}
              </div>
            </div>

            <div className="security-row">
              <span>
                <ExamIcon name="user" size={15} /> Face
              </span>

              <strong>
                {faceCount}
              </strong>
            </div>

            <div className="security-row">
              <span>
                <ExamIcon name="users" size={15} /> People
              </span>

              <strong>
                {faceCount}
              </strong>
            </div>

            <div className="security-row">
              <span>
                <ExamIcon name="smartphone" size={15} /> Phone
              </span>

              <strong
                className={
                  phoneDetected
                    ? "danger-text"
                    : "success-text"
                }
              >
                {phoneDetected
                  ? "Detected"
                  : "Clear"}
              </strong>
            </div>

            <div className="security-row">
              <span>
                <ExamIcon name="laptop" size={15} /> Devices
              </span>

              <strong>
                {deviceCount}
              </strong>
            </div>

            <div className="security-row">
              <span>
                <ExamIcon name="volume" size={15} /> Audio
              </span>

              <strong
                className={
                  speakingDetected
                    ? "warning-text"
                    : "success-text"
                }
              >
                {speakingDetected
                  ? "Voice"
                  : "Clear"}
              </strong>
            </div>

            <div className="security-row">
              <span>
                <ExamIcon name="alert" size={15} /> Voice violations
              </span>

              <strong
                className={
                  voiceViolationCount >=
                  2
                    ? "danger-text"
                    : voiceViolationCount >
                      0
                    ? "warning-text"
                    : ""
                }
              >
                {voiceViolationCount}/3
              </strong>
            </div>

            <div className="security-row">
              <span>
                <ExamIcon name="shield" size={15} /> Total violations
              </span>

              <strong>
                {violationCount}
              </strong>
            </div>

            <div className="monitoring-box">
              <span />
              <ExamIcon name="shield-check" size={15} />
              AI monitoring active
            </div>
          </div>
        </aside>
      </main>

      {showSubmitModal && (
        <div className="modal-backdrop">
          <div className="submit-dialog">
            <div className="dialog-icon">
              <ExamIcon name="help" size={24} />
            </div>

            <h2>
              Submit Test?
            </h2>

            <p>
              You answered {" "}
              <strong>
                {answeredCount}
              </strong>{" "}
              of {" "}
              <strong>
                {questions.length}
              </strong>{" "}
              questions.
            </p>

            {unansweredCount >
              0 && (
              <div className="dialog-warning">
                {
                  unansweredCount
                } {" "}
                question
                {unansweredCount >
                1
                  ? "s"
                  : ""} {" "}
                remain unanswered.
              </div>
            )}

            <div className="dialog-actions">
              <button
                onClick={() =>
                  setShowSubmitModal(
                    false
                  )
                }
              >
                Continue Test <ExamIcon name="arrow-right" size={16} />
              </button>

              <button
                className="confirm-submit"
                onClick={() =>
                  handleSubmitTest(
                    false
                  )
                }
                disabled={
                  submitting
                }
              >
                {submitting
                  ? "Submitting..."
                  : <>Submit Test <ExamIcon name="check" size={16} /></>}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}