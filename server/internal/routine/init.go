package routine

import (
	"context"
	"github.com/redis/go-redis/v9"
)

type ManagerData struct {
	RedisClient *redis.Client
}

func Init(data ManagerData) {
	go dropOldContainers(context.Background(), data.RedisClient)
}
