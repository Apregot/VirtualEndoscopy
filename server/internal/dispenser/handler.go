package dispenser

import (
	"bytes"
	"encoding/json"
	"github.com/julienschmidt/httprouter"
	"net/http"
	"strconv"
)

type Handler struct {
}

const SERVER_ADDR = "158.160.65.29"

func (h *Handler) Register(router *httprouter.Router) {
	router.GET("/atb/take", h.takeContainer)
}

type containerCreateResult struct {
	Address string
}

func (h *Handler) takeContainer(writer http.ResponseWriter, request *http.Request, params httprouter.Params) {
	var buffer bytes.Buffer
	buffer.WriteString(SERVER_ADDR)
	buffer.WriteString(":")

	container := UpDockerContainer()
	buffer.WriteString(strconv.Itoa(int(container.Port)))

	result := containerCreateResult{Address: buffer.String()}
	encoded, _ := json.Marshal(result)
	writer.Write(encoded)
}