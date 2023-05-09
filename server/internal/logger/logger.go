package logger

import (
	"log"
	"os"
	"time"
)

const logFile = "serverLog"

func WriteToLogString(message string) {
	WriteToLog([]byte(message))
}

func WriteToLog(message []byte) {
	f, err := os.OpenFile(logFile, os.O_RDWR|os.O_CREATE|os.O_APPEND, 0666)
	if err != nil {
		log.Fatalf("error opening file: %v", err)
	}
	defer f.Close()

	prefix := append([]byte(time.Now().Format(time.RFC3339)), []byte(": ")...)
	message = append(prefix, message...)

	_, err = f.Write(message)
	if err != nil {
		log.Fatalf("error writing to file: %v", err)
	}
}
