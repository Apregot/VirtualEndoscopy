<?php

namespace VirtualEndoscopy\Context;

use Exception;
use VirtualEndoscopy\Error;

abstract class Context
{
	public function execute(string $scriptName)
	{
		$scriptPath =
			$this->getProjectRoot()
			. $this->getScriptsDirectory()
			. $scriptName
			. $this->getScriptExtension()
		;

		if (!file_exists($scriptPath))
		{
			throw new Exception(
				'Script ' . $scriptName . ' not found',
				Error\Dictionary::ERROR_SCRIPT_FILE_NOT_FOUND
			);
		}

		return $this->runCommand($scriptPath);
	}

	//TODO добавить тип возврата (объект результата?)
	public function runCommand(string $script)
	{
		exec($script, $output,$resultCode);
		echo $resultCode;
		var_dump($output);
		echo "<br>";
		return array_shift($output);
	}

	private function getProjectRoot(): string
	{
		return realpath($_SERVER['DOCUMENT_ROOT']) . DIRECTORY_SEPARATOR . '..' . DIRECTORY_SEPARATOR;
	}

	abstract public function getType(): string;
	abstract protected function getScriptsDirectory(): string;
	abstract protected function getScriptExtension(): string;
}
