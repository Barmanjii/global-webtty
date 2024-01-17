package main

import (
	"encoding/json"
	"flag"
	"fmt"
	"io/ioutil"
	"log"
	"os"
	"time"

	// Import ZMQ
	zmq "github.com/pebbe/zmq4"
)

type Message struct {
	Client_Token string `json:"Client_Token"`
}

// startZMQServer starts the ZeroMQ server
// Using PAIR

func startZMQServer() {
	zmq_context, error := zmq.NewContext()
	if error != nil {
		log.Print("Context Error", error)
	}
	socket, err := zmq_context.NewSocket(zmq.PAIR)
	if err != nil {
		log.Println("Sokcet Error", err)
	}
	socket.Bind("tcp://*:5555")
	log.Println("Ready to Accept Connections!!!")

	for {
		time.Sleep(time.Duration(1) * time.Second)
		// Send reply back to client
		socket.Send(HostToken, 0)
		// Strictly handling this as we are only expecting the Return Token
		msg, err := socket.Recv(0)
		var token_value Message
		jsonError := json.Unmarshal([]byte(msg), &token_value)
		if jsonError != nil {
			log.Fatalf("Error occurred during unmarshaling. Error: %s", err.Error())
		}
		if err != nil {
			log.Println("Error")
		}
		if token_value.Client_Token != "" {
			ClientToken = token_value.Client_Token
			log.Print(ClientToken)
		}
		break
	}
}

func main() {
	log.Println("Starting the ZMQ Server......")
	go startZMQServer() // Start ZeroMQ server in a new goroutine
	oneWay := flag.Bool("o", false, "One-way connection with no response needed.")
	verbose := flag.Bool("v", false, "Verbose logging")
	nonInteractive := flag.Bool("non-interactive", false, "Set host to non-interactive")
	ni := flag.Bool("ni", false, "Set host to non-interactive")
	_ = flag.Bool("cmd", false, "The command to run. Default is \"bash -l\"\n"+
		"Because this flag consumes the remainder of the command line,\n"+
		"all other args (if present) must appear before this flag.\n"+
		"eg: webtty -o -v -ni -cmd docker run -it --rm alpine:latest sh")
	stunServer := flag.String("s", "stun:stun.l.google.com:19302", "The stun server to use")

	cmd := []string{"bash", "-l"}
	for i, arg := range os.Args {
		if arg == "-cmd" {
			cmd = os.Args[i+1:]
			os.Args = os.Args[:i]
		}
	}
	flag.Parse()
	if *verbose {
		log.SetFlags(log.LstdFlags | log.Lshortfile)
	} else {
		log.SetFlags(0)
		log.SetOutput(ioutil.Discard)
	}
	args := flag.Args()
	var offerString string
	if len(args) > 0 {
		offerString = args[len(args)-1]
	}

	var err error
	if len(offerString) == 0 {
		hc := hostSession{
			oneWay:         *oneWay,
			cmd:            cmd,
			nonInteractive: *nonInteractive || *ni,
		}
		hc.stunServers = []string{*stunServer}
		err = hc.run()
	} else {
		cc := clientSession{
			offerString: offerString,
		}
		cc.stunServers = []string{*stunServer}
		err = cc.run()
	}
	if err != nil {
		fmt.Printf("Quitting with an unexpected error: \"%s\"\n", err)
	}
}
