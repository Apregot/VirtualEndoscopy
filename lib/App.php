<?php
namespace VirtualEndoscopy;

use Exception;
use VirtualEndoscopy\Context;
use VirtualEndoscopy\Error;

final class App
{
	private static App $instance;
	private Context\Context $context;

	public static function getInstance(): self
	{
		if (empty(self::$instance))
		{
			self::$instance= new self();
		}

		return self::$instance;
	}

	public function getContext(): Context\Context
	{
		return $this->context;
	}

	private function __construct()
	{
		$this->initContext();
	}

	private function initContext(): void
	{
		$systemCode = $this->getSystemCode();
		if (!in_array($systemCode, Config::SUPPORTED_SYSTEMS))
		{
			throw new Exception('Your OS is not supported', Error\Dictionary::ERROR_OS_IS_NOT_SUPPORTED);
		}

		$this->context = match ($systemCode) {
			Config::WINDOWS => new Context\Windows(),
			Config::LINUX => new Context\Linux(),
			default => throw new Exception(
				'Context is not initialized',
				Error\Dictionary::ERROR_CONTEXT_IS_NOT_INITIALIZED,
			),
		};
	}

	/**
	 * @throws Exception
	 */
	private function getSystemCode(): string
	{
		return substr(php_uname('s'), 0 , 3);
	}
}
