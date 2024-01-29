import { Terminal } from "xterm";
import * as attach from "./attach";
import * as fullscreen from "xterm/src/addons/fullscreen/fullscreen";
import * as fit from "xterm/src/addons/fit/fit";

import "xterm/dist/xterm.css";
import "xterm/dist/addons/fullscreen/fullscreen.css";

// imports "Go"
import "./wasm_exec.js";

declare global {
  interface Window {
    mainRun: (baseURL: string, machineId: string, userId: string) => void;
  }
}

window.mainRun = (baseURL: string, machineId: string, userId: string) => {
  Terminal.applyAddon(attach);
  Terminal.applyAddon(fullscreen);
  Terminal.applyAddon(fit);
  // Polyfill for WebAssembly on Safari
  if (!WebAssembly.instantiateStreaming) {
    WebAssembly.instantiateStreaming = async (resp, importObject) => {
      const source = await (await resp).arrayBuffer();
      return await WebAssembly.instantiate(source, importObject);
    };
  }

  function waitForDecode() {
    if (typeof decode !== "undefined") {
      startSession(urlData);
    } else {
      setTimeout(waitForDecode, 250);
    }
  }

  // It will not work direclty because of the parcel = 1.12.5 
  // When you try to run the index.html from the parcel build it takes the WASM as a html not the application/wasm or wasm 
  // git issue -> https://github.com/parcel-bundler/parcel/issues/4867 (Vijay Barman 18th Jan 2024)
  const go = new Go();
  WebAssembly.instantiateStreaming(fetch("main.wasm"), go.importObject).then(
    result => {
      let mod = result.module;
      let inst = result.instance;
      go.run(inst);
    }
  );

  // Custom Sleep function
  function sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  const create10kbFile = (path: string, body: string): void =>
    fetch("https://up.10kb.site/" + path, {
      method: "POST",
      body: body
    })
      .then(resp => resp.text())
      .then(resp => { });


  const startSession = async (data: string) => {
    await sleep(3000);
    decode(data, (Sdp: any, tenKbSiteLoc: string, err: string) => {
      if (err != "") {
        console.log(err);
      }
      if (tenKbSiteLoc != "") {
        TenKbSiteLoc = tenKbSiteLoc;
      }
      pc
        .setRemoteDescription(
          new RTCSessionDescription({
            type: "offer",
            sdp: Sdp
          })
        )
        .catch(log);
      pc
        .createAnswer()
        .then(d => pc.setLocalDescription(d))
        .catch(log);
    });
  };

  let TenKbSiteLoc: string | null = null;

  const term = new Terminal();
  term.open(document.getElementById("terminal"));
  term.toggleFullScreen();
  term.fit();
  window.onresize = () => {
    term.fit();
  };
  term.write("Welcome to the Peppermint(WebTTY) web client.\n\r");

  let pc = new RTCPeerConnection({
    iceServers: [
      {
        urls: "stun:stun.l.google.com:19302"
      }
    ]
  });

  let log = (msg: string) => {
    term.write(msg + "\n\r");
  };

  let sendChannel = pc.createDataChannel("data");
  sendChannel.onclose = () => console.log("sendChannel has closed");
  sendChannel.onopen = () => {
    term.reset();
    term.terminadoAttach(sendChannel);
    sendChannel.send(JSON.stringify(["set_size", term.rows, term.cols]));
    console.log("sendChannel has opened");
  };
  // sendChannel.onmessage = e => {}

  pc.onsignalingstatechange = e => log(pc.signalingState);
  pc.oniceconnectionstatechange = e => log(pc.iceConnectionState);
  pc.onicecandidate = event => {
    if (event.candidate === null) {
      if (TenKbSiteLoc == null) {
        term.write(
          "Answer created. Send the following answer to the host:\n\r"
        );
        encode(pc.localDescription.sdp, async (encoded: string, err: string) => {
          if (err != "") {
            console.log(err);
          }
          try {
            await sendDataToAPI(encoded);
            term.write("Successfully sent the client token to the Backend Server");
          } catch (err) {
            term.write(`Couldn't sent the Client token to the Backend Server - ${err}`)
          }
          // term.write(encoded);
        });
      } else {
        term.write("Waiting for connection...");
        encode(pc.localDescription.sdp, (encoded: string, err: string) => {
          if (err != "") {
            console.log(err);
          }
          create10kbFile(TenKbSiteLoc, encoded);
        });
      }
    }
  };

  pc.onnegotiationneeded = e => console.log(e);

  window.sendMessage = () => {
    let message = document.getElementById("message").value;
    if (message === "") {
      return alert("Message must not be empty");
    }

    sendChannel.send(message);
  };

  let firstInput: boolean = false;
  const urlData = window.location.hash.substr(1);
  if (urlData != "") {
    try {
      waitForDecode();
      firstInput = true;
    } catch (err) {
      console.log(err);
    }
  }

  if (firstInput == false) {
    term.write(`Tryiny to connect the ${machineId}.\n\r`);
  }

  async function sendDataToAPI(clientToken: string): Promise<any> {
    try {
      const response = await fetch(baseURL + `client_token?machine_id=${machineId}&client_token=${clientToken}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const client_token = await response.json();
      return client_token; // Return the whole response data
    } catch (error) {
      console.error("Error sending data:", error);
      throw error;
    }
  }

  async function getDataFromAPI(): Promise<any> {
    try {
      const response = await fetch(baseURL + `host_token?machine_id=${machineId}&user_id=${userId}`);
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const data = await response.json();
      return data
    } catch (error) {
      console.error("Error fetching data:", error);
      throw error;
    }
  }

  async function initiateSessionWithAPIData() {
    try {
      const data = await getDataFromAPI();
      if ("host_token" in data) {
        let host_token = data.host_token
        startSession(host_token);
      } else {
        term.write(JSON.stringify(data))
      }

    } catch (err: any) {
      term.write("Server is down. Please try again later!!!! \n\r");
    }
  }

  initiateSessionWithAPIData();
}

// term.on("data", async data => {
//   if (!firstInput) {
//     term.reset();
//     try {
//       startSession(data);
//     } catch (err) {
//       console.log(err);
//       term.write(`There was an error with the offer: ${data}\n\r`);
//       term.write("Try entering the message again: ");
//       return;
//     }
//     firstInput = true;
//   }
// });


// mainRun("http://localhost:2323/", "SD0451011", "vijay-barman")

