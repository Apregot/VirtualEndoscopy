<?php

namespace VirtualEndoscopy\Connection;

use VirtualEndoscopy\Build;
use VirtualEndoscopy\Config;
use VirtualEndoscopy\Error;
use VirtualEndoscopy\Script;
use VirtualEndoscopy\Util\Result;

class ConnectionManager
{
	public function getConnection(): Result
	{
		$controller = (new Script\Controller());
		$result = $controller->run(Script\Dictionary::SCRIPT_GET_FREE_PORT, []);
		$freePort = $result->getData()['resultCode'];
		if ($freePort > 0)
		{
			$result = $controller->run(
				Script\Dictionary::SCRIPT_RUN_CONTAINER,
				[
					'dockerExecutable' => Config::getLocalConfig()['dockerExecutable'],
					'outerPort' => $freePort,
					'imageName' => Build\Dictionary::PEAK_LAYER,
				],
			);
		}
		else
		{
			throw new \Exception('No free port available', Error\Dictionary::ERROR_NO_FREE_PORT_AVAILABLE);
		}

		//TODO добавить проверку на то, что контейнер успешно создан
		$result->setData(['freePort' => $freePort]);

		return $result;
	}
}