package dispenser

import (
	"bytes"
	"fmt"
	"log"
	"os/exec"
	"strings"
)

type DockerContainer struct {
	Port uint16
}

func UpDockerContainer() DockerContainer {
	dropContainer()
	cmd := exec.Command("docker", "run", "-d", "-p", "80:8889", "pea/atb:latest")
	var out bytes.Buffer
	cmd.Stdout = &out
	err := cmd.Run()
	if err != nil {
		log.Fatal(err)
	}

	container := DockerContainer{Port: 80}
	return container
}

func dropContainer() {
	// команда для вывода списка контейнеров
	cmd1 := exec.Command("docker", "ps", "-q")

	// получаем список контейнеров
	output, err := cmd1.Output()
	if err != nil {
		fmt.Println(err)
		return
	}

	// команда для удаления контейнеров
	cmd2 := exec.Command("docker", "rm", "-f")

	// делим вывод команды для списка контейнеров на строки
	containers := strings.Split(string(output), "\n")

	// передаем каждый контейнер в команду для удаления
	for _, container := range containers {
		if container != "" {
			cmd2.Args = append(cmd2.Args, container)
		}
	}

	// выполнение команды для удаления контейнеров
	err = cmd2.Run()
	if err != nil {
		fmt.Println(err)
		return
	}

	log.Println("[CONTAINER DISPENSER] Активные контейнеры удалены")
}
