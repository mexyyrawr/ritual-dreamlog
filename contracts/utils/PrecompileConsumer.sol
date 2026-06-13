// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @title Minimal Precompile Consumer
/// @notice Provides _executePrecompile() for calling Ritual precompiles
abstract contract PrecompileConsumer {
    address constant LLM_INFERENCE_PRECOMPILE = address(0x0802);
    address constant HTTP_CALL_PRECOMPILE = address(0x0800);

    /// @notice Execute a precompile call
    /// @param precompile The precompile address
    /// @param input The ABI-encoded input
    /// @return output The raw output bytes
    function _executePrecompile(address precompile, bytes memory input) internal returns (bytes memory output) {
        (bool ok, bytes memory result) = precompile.call(input);
        require(ok, "precompile call failed");
        return result;
    }
}
