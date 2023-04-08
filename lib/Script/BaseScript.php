<?php

namespace VirtualEndoscopy\Script;

use VirtualEndoscopy\Error;

abstract class BaseScript
{
	private array $data = [];

	public function __construct(array $data = [])
	{
		if (!$this->validateData($data))
		{
			throw new \Exception(
				'Error while validating script data',
				Error\Dictionary::ERROR_WHILE_VALIDATING_SCRIPT_DATA
			);
		}
		$this->data = $this->prepareData($data);
	}
	public function getData(): array
	{
		return $this->data;
	}

	protected function validateData(array $data): bool
	{
		return true;
	}

	protected function prepareData(array $data): array
	{
		return [];
	}

	public function getPreparedData(): string
	{
		$result = '';
		foreach ($this->data as $datum)
		{
			if (is_numeric($datum) || is_string($datum))
			{
				$result .= ' ' . $datum;
			}
		}

		return $result;
	}
}