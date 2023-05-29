package app

import (
	"github.com/julienschmidt/httprouter"
	"github.com/redis/go-redis/v9"
	"log"
	"net/http"
	"server/internal/container"
	"server/internal/logger"
	"server/internal/routine"
)

func Run() {
	router := createRouter()
	logger.WriteToLog("[APP] Application started")
	log.Fatal(http.ListenAndServe(":80", router))
}

func createRouter() *httprouter.Router {
	router := httprouter.New()
	initPaths(router)
	return router
}

func createRedisClient() *redis.Client {
	return redis.NewClient(&redis.Options{
		Addr:     "127.0.0.1:6379",
		Password: "",
		DB:       0,
	})
}

func initPaths(router *httprouter.Router) {
	redisClient := createRedisClient()
	routine.Init(routine.ManagerData{RedisClient: redisClient})
	dispenserHandler := container.Handler{RedisClient: redisClient}
	dispenserHandler.Register(router)
	Register(router)
}
