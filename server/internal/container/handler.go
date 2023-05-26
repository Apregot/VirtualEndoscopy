package container

import (
	"bytes"
	"context"
	"encoding/json"
	"github.com/julienschmidt/httprouter"
	"github.com/redis/go-redis/v9"
	"net/http"
	"server/internal/logger"
	"strconv"
	"time"
)

type Handler struct {
	RedisClient *redis.Client
}

const ServerAddr = "158.160.65.29"

func (h *Handler) Register(router *httprouter.Router) {
	router.GET("/atb/take", h.takeConnection)
	router.POST("/atb/prolong", h.prolongConnection)
}

type containerCreateResult struct {
	Id      string
	Address string
}

type prolongContainerResult struct {
	Success bool
}

func (h *Handler) takeConnection(writer http.ResponseWriter, request *http.Request, params httprouter.Params) {
	writer.Header().Set("Access-Control-Allow-Origin", "*")
	writer.Header().Set("Access-Control-Allow-Headers", "origin, x-requested-with, content-type")
	writer.Header().Set("Access-Control-Allow-Methods", "PUT, GET, POST, DELETE, OPTIONS")

	container := UpDockerContainer()

	clientErr := h.RedisClient.Set(context.Background(), container.Id, time.Now().Format(time.RFC3339), time.Minute*20).Err()

	if clientErr != nil {
		logger.WriteToLog("[TAKE CONTAINER: REDIS SET VALUE ERROR] " + clientErr.Error())
		return
	}

	var buffer bytes.Buffer
	buffer.WriteString(ServerAddr + ":" + strconv.Itoa(int(container.Port)))

	logger.WriteToLog("[CONTAINER HANDLER] Created container address: " + buffer.String())

	result := containerCreateResult{Id: container.Id, Address: buffer.String()}

	encoded, _ := json.Marshal(result)
	_, err := writer.Write(encoded)
	if err != nil {
		logger.WriteToLog("[CONTAINER HANDLER: WRITE ERROR]" + err.Error())
	}
}

func (h *Handler) prolongConnection(writer http.ResponseWriter, request *http.Request, params httprouter.Params) {
	err := request.ParseForm()
	if err != nil {
		logger.WriteToLog("[PROLONG CONNECTION: FORM PARSE ERROR] " + err.Error())
		return
	}
	logger.WriteToLog("[FORM DATA]: " + request.Form.Encode())
	containerId := request.Form.Get("containerId")
	logger.WriteToLog("[CONTAINER ID TO PROLONG]: " + containerId)
	isExists, _ := h.RedisClient.Exists(context.Background(), containerId).Result()
	result := prolongContainerResult{Success: true}
	if isExists == 0 {
		logger.WriteToLog("[PROLONG CONNECTION: VALUE DOESN'T EXIST ERROR]")
		result.Success = false
	}

	if result.Success {
		clientErr := h.RedisClient.Set(context.Background(), containerId, time.Now().Format(time.RFC3339), time.Minute*20).Err()

		if clientErr != nil {
			logger.WriteToLog("[PROLONG CONNECTION: REDIS SET VALUE ERROR] " + clientErr.Error())
			result.Success = false
		}
	}

	encoded, _ := json.Marshal(result)
	_, writeErr := writer.Write(encoded)
	if writeErr != nil {
		logger.WriteToLog(writeErr.Error())
	}
}
