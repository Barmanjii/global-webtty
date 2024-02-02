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

  const go = new Go();

  // main.wasm contains the Go functions, like decode & encode.
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

  const startSession = async (data: string) => {
    await sleep(3000);
    //Decode function is written in Go.
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

  // Create the new Terminal which will capture the whole page using the term fullscreen and fit.
  const term = new Terminal();
  term.open(document.getElementById("terminal") as HTMLElement);
  term.toggleFullScreen();
  term.fit();
  window.onresize = () => {
    term.fit();
  };

  // Initialization Message - when the WebTTY is loaded.
  term.write("Welcome to the Peppermint(WebTTY) web client.\n\r");
  term.write(`Trying to connect the ${machineId}.\n\r`);

  // WebRTC Peer Connection
  let pc = new RTCPeerConnection({
    iceServers: [
      {
        urls: "stun:stun.l.google.com:19302"
      }
    ]
  });

  //Custom Log
  let log = (msg: string) => {
    term.write(msg + "\n\r");
  };

  // File Sharing 
  function FileSharing() {
    // TODO: Add the file sharing code.
  }

  // xterm terminal session
  function TerminalSession() {
    let sendChannel = pc.createDataChannel("data");
    sendChannel.onclose = () => console.log("sendChannel has closed");
    sendChannel.onopen = () => {
      term.reset();
      term.terminadoAttach(sendChannel);
      sendChannel.send(JSON.stringify(["set_size", term.rows, term.cols]));
      console.log("sendChannel has opened");
    };
  }


  // User input
  // NOTE - Need to figure it out how can we exit one option and then choose another option.
  let currentChoice: boolean = false;
  async function UserInput() {
    await sleep(1000);
    term.reset();
    term.write("1. Terminal \n\r2. File Sharing\n\r");
    term.on("data", data => {
      if (!currentChoice) {
        if (data == "1") {
          try {
            TerminalSession();
          } catch (err) {
            term.write("Unable to start the Terminal\n\r")
          }
        }
        else if (data == "2") {
          try {
            console.log("file shraing");
            return;
          } catch (err) {
            console.log("option2")
          }
        }
        else {
          try {
            term.reset();
            term.write("Incorrect Choice. Please Select between these \n\r1. Terminal \n\r2. File Sharing\n\r");
            console.log("Incorrect Choice, Please try again.");
            return;
          } catch (err) {
            console.log("aigag")
          }
        }
        currentChoice = true
      }
    });
  }
  // WebRTC connection change events
  pc.onsignalingstatechange = e => log(pc.signalingState);
  pc.oniceconnectionstatechange = e => log(pc.iceConnectionState);
  pc.onicecandidate = event => {
    if (event.candidate === null) {
      if (TenKbSiteLoc == null) {
        // Encode function written in Go.
        encode(pc.localDescription.sdp, async (encoded: string, err: string) => {
          if (err != "") {
            console.log(err);
          }
          try {
            await sendDataToAPI(encoded);
            UserInput();
          } catch (err) {
            term.write(`Couldn't sent the Client token to the Backend Server - ${err}\n\r`)
          }
        });
      }
    }
  };

  // WebRTC Event
  pc.onnegotiationneeded = e => console.log(e);

  // Backend API call.

  // Send the Client Token / Answer to Backend Server
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

  // Fetch the Host Token / Offer from the Backend Server
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

  // API call and filter the data.
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


// Local run 
mainRun("http://192.168.0.104:2323/", "SD0451001", "vijay-barman")

