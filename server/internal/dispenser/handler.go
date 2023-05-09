package dispenser

import (
	"bytes"
	"encoding/json"
	"github.com/julienschmidt/httprouter"
	"net/http"
	"server/internal/logger"
	"strconv"
)

type Handler struct {
}

const ServerAddr = "158.160.65.29"

func (h *Handler) Register(router *httprouter.Router) {
	router.GET("/atb/take", h.takeContainer)
}

type containerCreateResult struct {
	Address string
}

func (h *Handler) takeContainer(writer http.ResponseWriter, request *http.Request, params httprouter.Params) {
	writer.Header().Set("Access-Control-Allow-Origin", "*")
	writer.Header().Set("Access-Control-Allow-Headers", "origin, x-requested-with, content-type")
	writer.Header().Set("Access-Control-Allow-Methods", "PUT, GET, POST, DELETE, OPTIONS")
	var buffer bytes.Buffer
	buffer.WriteString(ServerAddr)
	buffer.WriteString(":")

	container := UpDockerContainer()
	buffer.WriteString(strconv.Itoa(int(container.Port)))

	logger.WriteToLog(buffer.String())

	result := containerCreateResult{Address: buffer.String()}
	encoded, _ := json.Marshal(result)
	_, err := writer.Write(encoded)
	if err != nil {
		logger.WriteToLog(err.Error())
	}
}
