package main

var (
	// HostToken - Updated from the host.go
	HostToken string

	// ClientToken - Fetch from the ZMQ Server and use it, to establish the connection
	ClientToken string

	// ClientTokenUpdateChan - Channel to notify about ClientToken updates
	ClientTokenUpdateChan = make(chan bool, 1)
)
