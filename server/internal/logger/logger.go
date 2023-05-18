package logger

import (
	"log"
	"os"
	"time"
)

const logFile = "serverLog"

func WriteToLogBytes(message []byte) {
	WriteToLog(string(message))
}

func WriteToLog(message string) {
	f, err := os.OpenFile(logFile, os.O_RDWR|os.O_CREATE|os.O_APPEND, 0666)
	if err != nil {
		log.Fatalf("error opening file: %v", err)
	}
	defer func(f *os.File) {
		err := f.Close()
		if err != nil {
			log.Fatalf("error closing a file: %v", err)
		}
	}(f)

	prefix := time.Now().Format(time.RFC3339) + ": "
	message = prefix + message + "\n"

	_, err = f.WriteString(message)
	if err != nil {
		log.Fatalf("error writing to file: %v", err)
	}
}
