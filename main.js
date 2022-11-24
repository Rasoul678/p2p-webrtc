import "./style.css";
import { nanoid } from "nanoid";
import AgoraRTM from "agora-rtm-sdk";
import feather from "feather-icons";

//* Initiate feather icons
feather.replace();

const APP_ID = "a2992b8a3a0e411d804c0e988fb2c45c";

let localStream;
let remoteStream;
let peerConnection;

let token = null;
let client;
let channel;
let uid = nanoid();

const queryString = window.location.search;
const urlParams = new URLSearchParams(queryString);
const roomID = urlParams.get("room");

if (!roomID) {
  window.location = "/lobby.html";
}

//* Stun servers
const servers = {
  iceServers: [
    {
      urls: ["stun:stun1.l.google.com:19302", "stun:stun2.l.google.com:19302"],
    },
  ],
};

const myVideo = document.querySelector("[data-js='myVideo']");
const userVideo = document.querySelector("[data-js='userVideo']");
const leaveButton = document.querySelector("[data-js='leaveButton']");
const cameraButton = document.querySelector("[data-js='cameraButton']");
const cameraONIcon = document.querySelector("[data-js='cameraONIcon']");
const cameraOFFIcon = document.querySelector("[data-js='cameraOFFIcon']");
const micButton = document.querySelector("[data-js='micButton']");
const micONIcon = document.querySelector("[data-js='micONIcon']");
const micOFFIcon = document.querySelector("[data-js='micOFFIcon']");

const init = async () => {
  client = AgoraRTM.createInstance(APP_ID);

  await client.login({ token, uid });

  channel = client.createChannel(roomID);
  await channel.join();

  channel.on("MemberJoined", handleUserJoined);

  channel.on("MemberLeft", handleUserLeft);

  client.on("MessageFromPeer", handleMessageFromPeer);

  await setLocalStream();

  localStream.onremovetrack = () => {
    console.log("Stream ended");
  };
};

async function setLocalStream() {
  localStream = await navigator.mediaDevices.getUserMedia({
    video: {
      width: { min: 640, ideal: 1920, max: 1920 },
      height: { min: 480, ideal: 1080, max: 1080 },
      facingMode: "user",
    },
    audio: true,
  });

  myVideo.srcObject = localStream;
}

function handleUserLeft(memberID) {
  userVideo.style.display = "none";
  myVideo.classList.remove("smallFrame");
}

async function handleMessageFromPeer(message, memberID) {
  message = JSON.parse(message.text);

  if (message.type === "offer") {
    createAnswer(memberID, message.offer);
  }

  if (message.type === "answer") {
    addAnswer(message.answer);
  }

  if (message.type === "candidate") {
    if (peerConnection) {
      peerConnection.addIceCandidate(message.candidate);
    }
  }
}

async function addAnswer(answer) {
  if (!peerConnection.currentRemoteDescription) {
    peerConnection.setRemoteDescription(answer);
  }
}

async function handleUserJoined(memberID) {
  console.log("A new user joined the channe: ", memberID);
  createOffer(memberID);
}

async function createPeerConnection(memberID) {
  peerConnection = new RTCPeerConnection(servers);

  remoteStream = new MediaStream();
  userVideo.srcObject = remoteStream;
  userVideo.style.display = "block";

  myVideo.classList.add("smallFrame");

  if (!localStream) {
    await setLocalStream();
  }

  localStream.getTracks().forEach((track) => {
    peerConnection.addTrack(track, localStream);
  });

  peerConnection.ontrack = (event) => {
    event.streams[0].getTracks().forEach((track) => {
      remoteStream.addTrack(track);
    });
  };

  peerConnection.onicecandidate = async (event) => {
    if (event.candidate) {
      const message = {
        type: "candidate",
        candidate: event.candidate,
      };

      client.sendMessageToPeer({ text: JSON.stringify(message) }, memberID);
    }
  };
}

async function createOffer(memberID) {
  await createPeerConnection(memberID);

  const offer = await peerConnection.createOffer();
  await peerConnection.setLocalDescription(offer);

  const message = {
    type: "offer",
    offer,
  };

  client.sendMessageToPeer({ text: JSON.stringify(message) }, memberID);
}

async function createAnswer(memberID, offer) {
  await createPeerConnection(memberID);

  await peerConnection.setRemoteDescription(offer);
  const answer = await peerConnection.createAnswer();
  await peerConnection.setLocalDescription(answer);

  const message = {
    type: "answer",
    answer,
  };

  client.sendMessageToPeer({ text: JSON.stringify(message) }, memberID);
}

async function leaveChannel() {
  await channel.leave();
  await client.logout();
}

async function toggleCamera() {
  const videoTrack = localStream
    .getTracks()
    .find((track) => track.kind === "video");

  if (videoTrack.enabled) {
    videoTrack.enabled = false;
    cameraButton.style.backgroundColor = "rgba(255, 80, 80, 1)";
    cameraButton.title = "enable camera";
    cameraONIcon.classList.toggle("hide");
    cameraOFFIcon.classList.toggle("hide");
  } else {
    videoTrack.enabled = true;
    cameraButton.style.backgroundColor = "rgba(179, 102, 249, 0.9)";
    cameraButton.title = "disable camera";
    cameraONIcon.classList.toggle("hide");
    cameraOFFIcon.classList.toggle("hide");
  }
}

async function toggleMic() {
  const audioTrack = localStream
    .getTracks()
    .find((track) => track.kind === "audio");

  if (audioTrack.enabled) {
    audioTrack.enabled = false;
    micButton.style.backgroundColor = "rgba(255, 80, 80, 1)";
    micButton.title = "unmute";
    micONIcon.classList.toggle("hide");
    micOFFIcon.classList.toggle("hide");
  } else {
    audioTrack.enabled = true;
    micButton.style.backgroundColor = "rgba(179, 102, 249, 0.9)";
    micButton.title = "mute";
    micONIcon.classList.toggle("hide");
    micOFFIcon.classList.toggle("hide");
  }
}

//* Handle toggle camera
cameraButton.addEventListener("click", toggleCamera);

//* Handle toggle mic
micButton.addEventListener("click", toggleMic);

//* Handle leave button click
leaveButton.addEventListener("click", () => {
  window.location = "/lobby.html";
});

//* Handle leave channel on tab close
window.addEventListener("beforeunload", leaveChannel);

init();

//* Handle errors
if (!myVideo) throw new Error('"myVideo" element not found!');
if (!userVideo) throw new Error('"userVideo" element not found!');
if (!leaveButton) throw new Error('"leaveButton" element not found!');
if (!cameraButton) throw new Error('"cameraButton" element not found!');
if (!cameraONIcon) throw new Error('"cameraONIcon" element not found!');
if (!cameraOFFIcon) throw new Error('"cameraOFFIcon" element not found!');
if (!micButton) throw new Error('"micButton" element not found!');
if (!micONIcon) throw new Error('"micONIcon" element not found!');
if (!micOFFIcon) throw new Error('"micOFFIcon" element not found!');
