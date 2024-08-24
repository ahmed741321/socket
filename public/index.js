// اتصال SockJS
const connection = new SockJS('/sockjs');
let currentChatUser = null;
const contactsList = document.getElementById('contactsList');
const messagesContainer = document.getElementById('messages');
const messageInput = document.getElementById('messageInput');
const chatWithSpan = document.getElementById('chatWith');
const sendMessageBtn = document.getElementById('sendMessageBtn');
const callBtn = document.getElementById('callBtn');
const videoCallBtn = document.getElementById('videoCallBtn');
const callRequestModal = document.getElementById('callRequestModal');
const callRequestMessage = document.getElementById('callRequestMessage');
const acceptCallBtn = document.getElementById('acceptCallBtn');
const rejectCallBtn = document.getElementById('rejectCallBtn');
const activeCallModal = document.getElementById('activeCallModal');
const endCallBtn = document.getElementById('endCallBtn');
const remoteVideo = document.getElementById('remoteVideo');
const localVideo = document.getElementById('localVideo');
const remoteAudio = document.getElementById('remoteAudio'); // إضافة عنصر الصوت

// تكوين WebRTC
const iceServers = {
    iceServers: [{ urls: "stun:stun.l.google.com:19302" }]
};

// متغيرات الاتصال عبر WebRTC
let localStream = null;
let peerConnection = null;

// عند الاتصال بالخادم
connection.onopen = function () {
    const clientId = prompt("Enter your name:");
    connection.send(JSON.stringify({ type: 'identify', clientId: clientId }));
};

// معالجة الرسائل الواردة
connection.onmessage = function (e) {
    const data = JSON.parse(e.data);

    switch (data.type) {
        case 'contacts':
            updateContactsList(data.contacts);
            break;
        case 'message':
            appendMessage(data.from, data.text);
            break;
        case 'call_request':
        case 'video_call_request':
            handleCallRequest(data);
            break;
        case 'call_accept':
        case 'video_call_accept':
            startCall(data.from, data.type === 'video_call_accept');
            break;
        case 'call_reject':
        case 'call_ended':
        case 'call_rejected':
            handleCallEnd();
            break;
        case 'ice_candidate':
            handleIceCandidate(data);
            break;
        case 'offer':
            handleOffer(data);
            break;
        case 'answer':
            handleAnswer(data);
            break;
        default:
            console.warn('Unknown message type:', data.type);
    }
};

// تحديث قائمة جهات الاتصال
function updateContactsList(contacts) {
    contactsList.innerHTML = ''; // تفريغ القائمة الحالية

    contacts.forEach(contact => {
        const li = document.createElement('li');
        li.textContent = contact;
        li.addEventListener('click', () => {
            currentChatUser = contact;
            chatWithSpan.textContent = contact;
            messagesContainer.innerHTML = '';  // تفريغ الرسائل السابقة عند اختيار جهة اتصال جديدة
        });
        contactsList.appendChild(li);
    });
}

// إرسال رسالة
sendMessageBtn.addEventListener('click', () => {
    if (currentChatUser && messageInput.value) {
        const message = messageInput.value;
        appendMessage('You', message);
        connection.send(JSON.stringify({
            type: 'message',
            targetClientId: currentChatUser,
            text: message
        }));
        messageInput.value = '';  // تفريغ حقل الإدخال
    }
});

function appendMessage(from, text) {
    const message = document.createElement('div');
    message.textContent = `${from}: ${text}`;
    messagesContainer.appendChild(message);
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
}

// بدء مكالمة صوتية
callBtn.addEventListener('click', () => {
    if (currentChatUser) {
        connection.send(JSON.stringify({
            type: 'call_request',
            targetClientId: currentChatUser
        }));
        activeCallModal.style.display = 'flex';  // عرض نافذة الاتصال النشط للمتصل
    }
});

// بدء مكالمة فيديو
videoCallBtn.addEventListener('click', () => {
    if (currentChatUser) {
        connection.send(JSON.stringify({
            type: 'video_call_request',
            targetClientId: currentChatUser
        }));
        activeCallModal.style.display = 'flex';  // عرض نافذة الاتصال النشط للمتصل
    }
});

// التعامل مع طلب المكالمة الواردة
function handleCallRequest(data) {
    if (!peerConnection) {
        // إظهار نافذة طلب المكالمة عند وصول مكالمة واردة
        callRequestModal.style.display = 'flex';
        callRequestMessage.textContent = `${data.from} is calling. Do you want to accept?`;

        acceptCallBtn.onclick = () => {
            connection.send(JSON.stringify({
                type: data.type === 'call_request' ? 'call_accept' : 'video_call_accept',
                targetClientId: data.from
            }));
            callRequestModal.style.display = 'none';  // إخفاء نافذة الطلب

            // تأكد من إغلاق أي اتصال موجود قبل بدء مكالمة جديدة
            if (peerConnection && peerConnection.signalingState !== 'stable') {
                peerConnection.close();
                peerConnection = null;
            }
            // بدء مكالمة جديدة
            activeCallModal.style.display = 'flex';   // عرض نافذة الاتصال النشط
        };

        rejectCallBtn.onclick = () => {
            connection.send(JSON.stringify({
                type: 'call_reject',
                targetClientId: data.from
            }));
            callRequestModal.style.display = 'none';  // إخفاء نافذة الطلب
        };
    }
}

// بدء المكالمة
function startCall(targetClientId, isVideo) {
    // تحقق من حالة peerConnection
    if (peerConnection) {
        const signalingState = peerConnection.signalingState;
        if (signalingState !== 'stable') {
            // أغلق الاتصال إذا كان في حالة غير مناسبة
            peerConnection.close();
            peerConnection = null;
        }
    }

    peerConnection = new RTCPeerConnection(iceServers);

    // تعيين حدث ontrack
    peerConnection.ontrack = event => {
        if (isVideo) {
            if (remoteVideo) {
                remoteVideo.srcObject = event.streams[0];
            } else {
                console.error('Remote video element not found');
            }
        } else {
            if (remoteAudio) {
                remoteAudio.srcObject = event.streams[0];
                // ضبط الصوت لتشغيله عبر مكبر الصوت (إذا كان supported)
                if (remoteAudio.setSinkId) {
                    remoteAudio.setSinkId('default').catch(error => console.error('Error setting sink ID:', error));
                }
            } else {
                console.error('Remote audio element not found');
            }
        }
    };

    navigator.mediaDevices.getUserMedia({ audio: true, video: isVideo })
        .then(stream => {
            localStream = stream;

            // تعيين تدفق الوسائط المحلي إلى عنصر الفيديو المحلي
            if (localVideo) {
                localVideo.srcObject = localStream;
            }

            stream.getTracks().forEach(track => {
                peerConnection.addTrack(track, stream);
            });

            peerConnection.onicecandidate = event => {
                if (event.candidate) {
                    connection.send(JSON.stringify({
                        type: 'ice_candidate',
                        targetClientId: targetClientId,
                        candidate: event.candidate
                    }));
                }
            };

            return peerConnection.createOffer();
        })
        .then(offer => peerConnection.setLocalDescription(offer))
        .then(() => {
            connection.send(JSON.stringify({
                type: 'offer',
                targetClientId: targetClientId,
                offer: peerConnection.localDescription,
                isVideo: isVideo
            }));
        })
        .catch(error => console.error('Error creating offer:', error));
}

function handleOffer(data) {
    if (peerConnection) {
        const signalingState = peerConnection.signalingState;
        if (signalingState !== 'stable') {
            // أغلق الاتصال إذا كان في حالة غير مناسبة
            peerConnection.close();
            peerConnection = null;
        }
    }

    peerConnection = new RTCPeerConnection(iceServers);

    // تعيين حدث ontrack
    peerConnection.ontrack = event => {
        if (data.isVideo) {
            if (remoteVideo) {
                remoteVideo.srcObject = event.streams[0];
            } else {
                console.error('Remote video element not found');
            }
        } else {
            if (remoteAudio) {
                remoteAudio.srcObject = event.streams[0];
                // ضبط الصوت لتشغيله عبر مكبر الصوت (إذا كان supported)
                if (remoteAudio.setSinkId) {
                    remoteAudio.setSinkId('default').catch(error => console.error('Error setting sink ID:', error));
                }
            } else {
                console.error('Remote audio element not found');
            }
        }
    };

    peerConnection.setRemoteDescription(new RTCSessionDescription(data.offer))
        .then(() => navigator.mediaDevices.getUserMedia({ audio: true, video: data.isVideo }))
        .then(stream => {
            localStream = stream;

            // تعيين تدفق الوسائط المحلي إلى عنصر الفيديو المحلي
            if (localVideo) {
                localVideo.srcObject = localStream;
            }

            stream.getTracks().forEach(track => {
                peerConnection.addTrack(track, stream);
            });

            return peerConnection.createAnswer();
        })
        .then(answer => peerConnection.setLocalDescription(answer))
        .then(() => {
            connection.send(JSON.stringify({
                type: 'answer',
                targetClientId: data.from,
                answer: peerConnection.localDescription
            }));
        })
        .catch(error => console.error('Error handling offer:', error));
}

// التعامل مع الإجابة الواردة
function handleAnswer(data) {
    peerConnection.setRemoteDescription(new RTCSessionDescription(data.answer))
        .catch(error => console.error('Error setting remote description:', error));
}

// التعامل مع مرشحي ICE
function handleIceCandidate(data) {
    const candidate = new RTCIceCandidate(data.candidate);
    peerConnection.addIceCandidate(candidate)
        .catch(error => console.error('Error adding ICE candidate:', error));
}

// إنهاء المكالمة
endCallBtn.addEventListener('click', () => {
    if (peerConnection) {
        peerConnection.close();
        peerConnection = null;
        if (localStream) {
            localStream.getTracks().forEach(track => track.stop());
        }
        activeCallModal.style.display = 'none'; // إخفاء نافذة الاتصال النشط
        // أرسل رسالة لإنهاء المكالمة للطرف الآخر
        if (currentChatUser) {
            connection.send(JSON.stringify({
                type: 'call_ended',
                targetClientId: currentChatUser
            }));
        }
    }
});

// التعامل مع رفض المكالمة
function handleCallEnd() {
    if (peerConnection) {
        peerConnection.close();
        peerConnection = null;
    }
    if (localStream) {
        localStream.getTracks().forEach(track => track.stop());
    }
    activeCallModal.style.display = 'none'; // إخفاء نافذة الاتصال النشط
}
