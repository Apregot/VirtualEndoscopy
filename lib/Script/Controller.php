<?php

namespace VirtualEndoscopy\Script;

use VirtualEndoscopy\App;
use VirtualEndoscopy\Util\Result;

class Controller
{
	public const SCRIPT_CLASS_POSTFIX = 'Script';

	public function run(string $scriptName, array $data): Result
	{
		$context = App::getInstance()->getContext();
		$scriptPath = $context->getScriptPath($scriptName);
		/** @var BaseScript $script */
		$script = new (__NAMESPACE__ . '\\' . ucfirst($scriptName) . self::SCRIPT_CLASS_POSTFIX)($data);

		return $this->executeScript($scriptPath . $script->getPreparedData());
	}

	protected function executeScript(string $script): Result
	{
		$result = new Result();
		exec($script, $output, $resultCode);
		$result->setData([
			'resultCode' => $resultCode,
			'output' => $output,
		]);

		return $result;
	}
}