package routine

import (
	"context"
	"fmt"
	"github.com/redis/go-redis/v9"
	"log"
	"os/exec"
	"server/internal/container"
	"server/internal/logger"
	"strings"
	"time"
)

func dropOldContainers(ctx context.Context, redisClient *redis.Client) {
	for {
		select {
		case <-ctx.Done():
			return
		default:
			logger.WriteToLog("[DROP CONTAINERS ROUTINE]: Routine started")
			// команда для вывода списка контейнеров
			// docker container ls --all --filter=ancestor=$IMAGE_ID --format "{{.ID}}"
			getContainersCmd := exec.Command(
				"docker",
				"container",
				"ls",
				"--all",
				"--no-trunc",
				"--filter=ancestor="+container.ImageName,
				"--format={{.ID}}",
			)
			// получаем список контейнеров
			output, err := getContainersCmd.Output()
			if err != nil {
				logger.WriteToLog("[DROP CONTAINERS ROUTINE]: Get containers error:  " + err.Error())
				break
			}
			logger.WriteToLog("[DROP CONTAINERS ROUTINE]: Get containers success")
			// делим вывод команды для списка контейнеров на строки
			containers := strings.Split(string(output), "\n")

			var containersToDrop []string
			for _, containerId := range containers {
				if len(containerId) == 0 {
					continue
				}
				isExists, _ := redisClient.Exists(context.Background(), containerId).Result()
				minimumPossibleTime := time.Now().Round(time.Minute).Add(-1 * container.LifeTime)

				if isExists == 1 {
					containerLastProlongTime, _ := redisClient.Get(context.Background(), containerId).Result()
					logger.WriteToLog("[DROP CONTAINERS ROUTINE]: Get containerLastProlongTime success")
					containerProlongTimeParsed, parseErr := time.Parse(time.RFC3339, containerLastProlongTime)
					logger.WriteToLog("[DROP CONTAINERS ROUTINE]: Parse time success")
					if parseErr != nil {
						logger.WriteToLog("[DROP CONTAINERS ROUTINE]: Get containers error:  " + parseErr.Error())
						continue
					}

					if !containerProlongTimeParsed.After(minimumPossibleTime) {
						containersToDrop = append(containersToDrop, containerId)
					}
				} else {
					logger.WriteToLog("[DROP OLD CONNECTION ERROR: VALUE DOESN'T EXIST]")
					containersToDrop = append(containersToDrop, containerId)
				}

				if len(containersToDrop) > 0 {
					logger.WriteToLog("[DROP CONTAINERS ROUTINE]: Has containers to drop")
					dropContainers(containersToDrop)
				} else {
					logger.WriteToLog("[DROP CONTAINERS ROUTINE]: Has no containers to drop")
				}
			}
		}
		time.Sleep(time.Minute * 10)
	}

}

func dropContainers(containersToDrop []string) {

	// команда для удаления контейнеров
	cmd2 := exec.Command("docker", "rm", "-f")

	// передаем каждый контейнер в команду для удаления
	for _, containerId := range containersToDrop {
		if containerId != "" {
			cmd2.Args = append(cmd2.Args, containerId)
		}
	}

	// выполнение команды для удаления контейнеров
	err := cmd2.Run()
	if err != nil {
		fmt.Println(err)
		return
	}

	log.Println("[CONTAINER DISPENSER] Старые контейнеры удалены")
}
