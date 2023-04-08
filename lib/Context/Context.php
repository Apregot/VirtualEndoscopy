<?php

namespace VirtualEndoscopy\Context;

use Exception;
use VirtualEndoscopy\Error;

abstract class Context
{
	public function getScriptPath(string $scriptName): string
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

		return $this->getScriptRunner() . $scriptPath;
	}

	private function getProjectRoot(): string
	{
		return realpath($_SERVER['DOCUMENT_ROOT']) . DIRECTORY_SEPARATOR . '..' . DIRECTORY_SEPARATOR;
	}

	abstract public function getType(): string;
	abstract public function getScriptRunner(): string;
	abstract protected function getScriptsDirectory(): string;
	abstract protected function getScriptExtension(): string;
}
