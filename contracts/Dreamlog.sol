// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {PrecompileConsumer} from "./utils/PrecompileConsumer.sol";

contract Dreamlog is PrecompileConsumer {
    address constant RITUAL_WALLET = 0x532F0dF0896F353d8C3DD8cc134e8129DA2a3948;

    struct Dream {
        uint256 id;
        address dreamer;
        string dreamText;
        string interpretation;
        string mood;
        string archetype;
        string emotion;
        string language;
        uint256 timestamp;
        bool interpreted;
    }

    uint256 public nextDreamId;
    mapping(uint256 => Dream) public dreams;
    mapping(address => uint256[]) public dreamerDreams;

    event DreamSubmitted(uint256 indexed dreamId, address indexed dreamer, string language);
    event DreamInterpreted(uint256 indexed dreamId, string mood, string archetype);

    /// @notice Deposit RITUAL to RitualWallet for LLM fees
    function depositForFees() external payable {
        (bool ok,) = RITUAL_WALLET.call{value: msg.value}(
            abi.encodeWithSignature("deposit(uint256)", 100000)
        );
        require(ok, "Deposit to RitualWallet failed");
    }

    /// @notice Submit a dream to the journal
    function submitDream(string calldata dreamText, string calldata language) external returns (uint256 dreamId) {
        dreamId = nextDreamId++;
        dreams[dreamId] = Dream({
            id: dreamId,
            dreamer: msg.sender,
            dreamText: dreamText,
            interpretation: "",
            mood: "",
            archetype: "",
            emotion: "",
            language: language,
            timestamp: block.timestamp,
            interpreted: false
        });
        dreamerDreams[msg.sender].push(dreamId);
        emit DreamSubmitted(dreamId, msg.sender, language);
    }

    /// @notice Call the LLM precompile to interpret a dream
    function interpretDream(uint256 dreamId, bytes calldata llmInput) external payable {
        require(dreams[dreamId].dreamer == msg.sender, "not your dream");
        require(!dreams[dreamId].interpreted, "already interpreted");

        // Deposit to RitualWallet first if value is sent
        if (msg.value > 0) {
            (bool depositOk,) = RITUAL_WALLET.call{value: msg.value}(
                abi.encodeWithSignature("deposit(uint256)", 100000)
            );
            require(depositOk, "Deposit to RitualWallet failed");
        }

        bytes memory output = _executePrecompile(LLM_INFERENCE_PRECOMPILE, llmInput);

        (bool hasError, bytes memory completionData, , string memory errorMessage) =
            abi.decode(output, (bool, bytes, bytes, string));

        require(!hasError, errorMessage);

        string memory interpretation = _bytesToString(completionData);
        dreams[dreamId].interpretation = interpretation;
        dreams[dreamId].interpreted = true;

        emit DreamInterpreted(dreamId, "mystical", "unknown");
    }

    /// @notice Store interpretation result
    function storeResult(uint256 dreamId, string calldata interpretation) external {
        require(dreams[dreamId].dreamer == msg.sender, "not your dream");
        dreams[dreamId].interpretation = interpretation;
        dreams[dreamId].interpreted = true;
    }

    function getDream(uint256 dreamId) external view returns (Dream memory) {
        return dreams[dreamId];
    }

    function getDreamsByAddress(address dreamer) external view returns (uint256[] memory) {
        return dreamerDreams[dreamer];
    }

    function getTotalDreams() external view returns (uint256) {
        return nextDreamId;
    }

    function _bytesToString(bytes memory data) internal pure returns (string memory) {
        bytes memory result = new bytes(data.length);
        for (uint256 i = 0; i < data.length; i++) {
            result[i] = data[i];
        }
        return string(result);
    }
}
