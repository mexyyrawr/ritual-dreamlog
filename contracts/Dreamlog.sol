// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {PrecompileConsumer} from "./utils/PrecompileConsumer.sol";

contract Dreamlog is PrecompileConsumer {
    address constant RITUAL_WALLET = 0x532F0dF0896F353d8C3DD8cc134e8129DA2a3948;

    struct Dream {
        address owner;
        string text;
        uint256 timestamp;
        uint8 mood;
        string interpretation;
        string archetype;
    }

    mapping(uint256 => Dream) public dreams;
    uint256 public dreamCount;
    address public owner;

    event DreamSubmitted(uint256 indexed dreamId, address indexed owner, string text);
    event DreamInterpreted(uint256 indexed dreamId, string interpretation, uint8 mood);

    constructor() {
        owner = msg.sender;
    }

    receive() external payable {
        (bool ok,) = RITUAL_WALLET.call{value: msg.value}(
            abi.encodeWithSelector(
                bytes4(keccak256("deposit(uint256)")),
                uint256(100000)
            )
        );
        require(ok, "Auto-deposit failed");
    }

    function submitDream(string calldata text) external returns (uint256 dreamId) {
        dreamId = dreamCount++;
        dreams[dreamId] = Dream({
            owner: msg.sender,
            text: text,
            timestamp: block.timestamp,
            mood: 0,
            interpretation: "",
            archetype: ""
        });
        emit DreamSubmitted(dreamId, msg.sender, text);
    }

    /// @notice Submit dream + call LLM in a SINGLE transaction (1 popup!)
    /// Frontend pre-encodes LLM request with viem, passes as bytes
    function submitAndInterpret(string calldata text, bytes calldata llmInput) external returns (uint256 dreamId) {
        // 1. Store dream
        dreamId = dreamCount++;
        dreams[dreamId] = Dream({
            owner: msg.sender,
            text: text,
            timestamp: block.timestamp,
            mood: 0,
            interpretation: "",
            archetype: ""
        });
        emit DreamSubmitted(dreamId, msg.sender, text);

        // 2. Call LLM precompile (pre-encoded bytes from frontend)
        bytes memory rawOutput = _executePrecompile(LLM_INFERENCE_PRECOMPILE, llmInput);

        // 3. Decode result
        (, bytes memory actualOutput) = abi.decode(rawOutput, (bytes, bytes));
        (bool hasError, bytes memory completionData, , string memory errorMessage) =
            abi.decode(actualOutput, (bool, bytes, bytes, string));

        if (!hasError) {
            (, , , , , , uint256 choicesCount, bytes[] memory choicesData, ) =
                abi.decode(completionData, (string, string, uint256, string, string, string, uint256, bytes[], bytes));

            string memory content = "";
            if (choicesCount > 0 && choicesData.length > 0) {
                (, , bytes memory messageData) = abi.decode(choicesData[0], (uint256, string, bytes));
                (, content, , , ) = abi.decode(messageData, (string, string, string, uint256, bytes[]));
            }

            uint8 mood = _parseMood(content);
            dreams[dreamId].interpretation = content;
            dreams[dreamId].mood = mood;
            emit DreamInterpreted(dreamId, content, mood);
        }
        // If LLM fails, dream is still stored — user can retry with interpretDream
    }

    function interpretDream(uint256 dreamId, bytes calldata llmInput) external {
        require(dreamId < dreamCount, "Dream not found");

        bytes memory rawOutput = _executePrecompile(LLM_INFERENCE_PRECOMPILE, llmInput);
        (, bytes memory actualOutput) = abi.decode(rawOutput, (bytes, bytes));
        (bool hasError, bytes memory completionData, , string memory errorMessage) =
            abi.decode(actualOutput, (bool, bytes, bytes, string));

        require(!hasError, errorMessage);

        (, , , , , , uint256 choicesCount, bytes[] memory choicesData, ) =
            abi.decode(completionData, (string, string, uint256, string, string, string, uint256, bytes[], bytes));

        string memory content = "";
        if (choicesCount > 0 && choicesData.length > 0) {
            (, , bytes memory messageData) = abi.decode(choicesData[0], (uint256, string, bytes));
            (, content, , , ) = abi.decode(messageData, (string, string, string, uint256, bytes[]));
        }

        uint8 mood = _parseMood(content);
        dreams[dreamId].interpretation = content;
        dreams[dreamId].mood = mood;
        emit DreamInterpreted(dreamId, content, mood);
    }

    function storeResult(uint256 dreamId, string calldata interpretation) external {
        require(dreamId < dreamCount, "Dream not found");
        require(bytes(dreams[dreamId].interpretation).length == 0, "Already interpreted");
        uint8 mood = _parseMood(interpretation);
        dreams[dreamId].interpretation = interpretation;
        dreams[dreamId].mood = mood;
        emit DreamInterpreted(dreamId, interpretation, mood);
    }

    function _parseMood(string memory text) internal pure returns (uint8) {
        bytes memory b = bytes(text);
        if (_contains(b, "mystical") || _contains(b, "MYSTICAL") || _contains(b, "mystic")) return 1;
        if (_contains(b, "dark") || _contains(b, "DARK") || _contains(b, "shadow")) return 2;
        if (_contains(b, "zen") || _contains(b, "ZEN") || _contains(b, "peace") || _contains(b, "calm")) return 3;
        if (_contains(b, "wonder") || _contains(b, "WONDER") || _contains(b, "magical") || _contains(b, "joy")) return 4;
        if (_contains(b, "horror") || _contains(b, "HORROR") || _contains(b, "fear") || _contains(b, "terror")) return 5;
        if (_contains(b, "confus") || _contains(b, "CONFUS") || _contains(b, "absurd") || _contains(b, "surreal")) return 6;
        return 1;
    }

    function _contains(bytes memory haystack, string memory needle) internal pure returns (bool) {
        bytes memory needleBytes = bytes(needle);
        if (needleBytes.length > haystack.length) return false;
        for (uint256 i = 0; i <= haystack.length - needleBytes.length; i++) {
            bool found = true;
            for (uint256 j = 0; j < needleBytes.length; j++) {
                if (haystack[i + j] != needleBytes[j]) {
                    found = false;
                    break;
                }
            }
            if (found) return true;
        }
        return false;
    }
}
