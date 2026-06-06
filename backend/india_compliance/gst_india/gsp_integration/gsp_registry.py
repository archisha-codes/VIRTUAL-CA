"""
GSP Integration - GSP Registry

Registry for managing multiple GSP providers with failover support.
"""

import logging
from typing import Dict, Any, Optional, List, Type
from datetime import datetime, timedelta
from threading import Lock

from india_compliance.gst_india.gsp_integration.models import (
    GSPProvider,
    GSPProviderInfo,
    GSPConfig,
    GSPHealthResponse,
    GSPHealthStatus,
    GSPHealthCheckResult,
    AuthStatus
)
from india_compliance.gst_india.gsp_integration.gsp_base import GSPBase
from india_compliance.gst_india.gsp_integration.exceptions import (
    GSPNotConfiguredError,
    GSPHealthCheckError,
    GSPException
)


logger = logging.getLogger(__name__)


# GSP Provider Information Registry
GSP_PROVIDER_INFO: Dict[GSPProvider, GSPProviderInfo] = {
    GSPProvider.CLEARTAX: GSPProviderInfo(
        provider=GSPProvider.CLEARTAX,
        name="ClearTax",
        description="ClearTax GSP - Leading GST Suvidha Provider",
        api_version="v1",
        is_supported=True,
        features=[
            "GSTR-1 Filing",
            "GSTR-2A/2B Download",
            "GSTR-3B Filing",
            "GSTR-9 Annual Return",
            "E-Way Bill",
            "E-Invoice"
        ],
        rate_limit=100
    ),
    GSPProvider.GST_SAHAY: GSPProviderInfo(
        provider=GSPProvider.GST_SAHAY,
        name="GST Sahay",
        description="GST Sahay GSP - Government empaneled GSP",
        api_version="v1",
        is_supported=True,
        features=[
            "GSTR-1 Filing",
            "GSTR-2A/2B Download",
            "GSTR-3B Filing",
            "GSTR-9 Annual Return"
        ],
        rate_limit=50
    ),
    GSPProvider.TALLY_NEXT: GSPProviderInfo(
        provider=GSPProvider.TALLY_NEXT,
        name="TallyNext",
        description="TallyNext GSP - Integrated with Tally Accounting",
        api_version="v1",
        is_supported=True,
        features=[
            "GSTR-1 Filing",
            "GSTR-2A/2B Download",
            "GSTR-3B Filing",
            "GSTR-9 Annual Return"
        ],
        rate_limit=50
    ),
    GSPProvider.MASTER_INDIA: GSPProviderInfo(
        provider=GSPProvider.MASTER_INDIA,
        name="Master India",
        description="Master India GSP - Trusted GSP Partner",
        api_version="v1",
        is_supported=True,
        features=[
            "GSTR-1 Filing",
            "GSTR-2A/2B Download",
            "GSTR-3B Filing"
        ],
        rate_limit=30
    ),
    GSPProvider.COMPLETE_GSTR: GSPProviderInfo(
        provider=GSPProvider.COMPLETE_GSTR,
        name="Complete GSTR",
        description="Complete GSTR GSP - Comprehensive GST Solutions",
        api_version="v1",
        is_supported=True,
        features=[
            "GSTR-1 Filing",
            "GSTR-2A/2B Download",
            "GSTR-3B Filing"
        ],
        rate_limit=30
    ),
    GSPProvider.MOCK: GSPProviderInfo(
        provider=GSPProvider.MOCK,
        name="Mock GSP",
        description="Mock GSP for testing purposes",
        api_version="v1",
        is_supported=True,
        features=[
            "GSTR-1 Filing",
            "GSTR-2A/2B Download",
            "GSTR-3B Filing",
            "GSTR-9 Annual Return"
        ],
        rate_limit=1000
    )
}


class GSPRegistry:
    """
    Registry for managing multiple GSP providers.
    
    Provides:
    - GSP provider registration
    - Credentials management
    - Health checks
    - Failover between providers
    """
    
    def __init__(self):
        self._providers: Dict[GSPProvider, Type[GSPBase]] = {}
        self._instances: Dict[GSPProvider, GSPBase] = {}
        self._configs: Dict[GSPProvider, GSPConfig] = {}
        self._default_provider: Optional[GSPProvider] = None
        self._lock = Lock()
        self._health_cache: Dict[GSPProvider, GSPHealthResponse] = {}
        self._health_cache_expiry: Optional[datetime] = None
    
    def register_provider(
        self,
        provider: GSPProvider,
        provider_class: Type[GSPBase],
        config: Optional[GSPConfig] = None
    ) -> None:
        """
        Register a GSP provider class.
        
        Args:
            provider: GSP provider enum
            provider_class: GSP implementation class
            config: Optional configuration for the provider
        """
        with self._lock:
            self._providers[provider] = provider_class
            if config:
                self._configs[provider] = config
                # Create instance if config provided
                self._instances[provider] = provider_class(config.model_dump())
                if config.is_default:
                    self._default_provider = provider
            logger.info(f"Registered GSP provider: {provider.value}")
    
    def unregister_provider(self, provider: GSPProvider) -> None:
        """
        Unregister a GSP provider.
        
        Args:
            provider: GSP provider to unregister
        """
        with self._lock:
            if provider in self._instances:
                del self._instances[provider]
            if provider in self._configs:
                del self._configs[provider]
            if self._default_provider == provider:
                self._default_provider = None
            logger.info(f"Unregistered GSP provider: {provider.value}")
    
    def configure_provider(self, config: GSPConfig) -> None:
        """
        Configure a GSP provider with credentials.
        
        Args:
            config: GSP configuration
        """
        provider = config.provider
        
        with self._lock:
            if provider not in self._providers:
                raise GSPNotConfiguredError(
                    provider=provider.value,
                    message=f"Provider {provider.value} not registered"
                )
            
            self._configs[provider] = config
            # Create or update instance
            self._instances[provider] = self._providers[provider](config.model_dump())
            
            if config.is_default:
                # Unset previous default
                for p, c in self._configs.items():
                    if p != provider and c.is_default:
                        c.is_default = False
                        self._configs[p] = c
                self._default_provider = provider
            
            logger.info(f"Configured GSP provider: {provider.value}")
    
    def get_provider(
        self,
        provider: Optional[GSPProvider] = None
    ) -> GSPBase:
        """
        Get a GSP provider instance.
        
        Args:
            provider: GSP provider to get (uses default if not specified)
            
        Returns:
            GSP provider instance
            
        Raises:
            GSPNotConfiguredError: If provider not configured
        """
        with self._lock:
            if provider is None:
                provider = self._default_provider
            
            if provider is None:
                raise GSPNotConfiguredError(
                    message="No default provider configured"
                )
            
            if provider not in self._instances:
                if provider not in self._configs:
                    raise GSPNotConfiguredError(
                        provider=provider.value,
                        message=f"Provider {provider.value} not configured"
                    )
                # Create instance from config
                self._instances[provider] = self._providers[provider](
                    self._configs[provider].model_dump()
                )
            
            return self._instances[provider]
    
    def get_config(
        self,
        provider: Optional[GSPProvider] = None
    ) -> Optional[GSPConfig]:
        """Get configuration for a provider."""
        if provider is None:
            provider = self._default_provider
        
        return self._configs.get(provider)
    
    def list_providers(self) -> List[GSPProviderInfo]:
        """
        List all registered providers with their info.
        
        Returns:
            List of provider information
        """
        result = []
        for provider in GSPProvider:
            if provider in self._providers:
                info = GSP_PROVIDER_INFO.get(provider)
                if info:
                    result.append(info)
        return result
    
    def list_configured_providers(self) -> List[GSPProvider]:
        """List all configured providers."""
        return list(self._configs.keys())
    
    def get_default_provider(self) -> Optional[GSPProvider]:
        """Get the default provider."""
        return self._default_provider
    
    def set_default_provider(self, provider: GSPProvider) -> None:
        """
        Set the default provider.
        
        Args:
            provider: Provider to set as default
        """
        if provider not in self._configs:
            raise GSPNotConfiguredError(
                provider=provider.value,
                message=f"Cannot set {provider.value} as default - not configured"
            )
        
        with self._lock:
            # Unset previous default
            for p, config in self._configs.items():
                if config.is_default and p != provider:
                    config.is_default = False
                    self._configs[p] = config
            
            # Set new default
            self._configs[provider].is_default = True
            self._default_provider = provider
    
    def health_check(
        self,
        provider: Optional[GSPProvider] = None,
        force_refresh: bool = False
    ) -> GSPHealthCheckResult:
        """
        Perform health check on GSP providers.
        
        Args:
            provider: Specific provider to check (checks all if None)
            force_refresh: Force refresh cached results
            
        Returns:
            Health check result
        """
        current_time = datetime.now()
        
        # Return cached results if valid
        if (not force_refresh 
            and provider is None 
            and self._health_cache 
            and self._health_cache_expiry 
            and current_time < self._health_cache_expiry):
            return GSPHealthCheckResult(
                overall_status=GSPHealthStatus.HEALTHY,
                providers=list(self._health_cache.values()),
                default_provider=self._default_provider,
                last_checked=self._health_cache_expiry
            )
        
        providers_to_check = [provider] if provider else list(self._configs.keys())
        results = []
        
        for p in providers_to_check:
            try:
                instance = self.get_provider(p)
                health_data = instance.health_check()
                response = GSPHealthResponse(
                    provider=p,
                    status=health_data.get("status", GSPHealthStatus.UNKNOWN),
                    latency_ms=health_data.get("latency_ms"),
                    message=health_data.get("message")
                )
            except Exception as e:
                logger.error(f"Health check failed for {p.value}: {str(e)}")
                response = GSPHealthResponse(
                    provider=p,
                    status=GSPHealthStatus.UNHEALTHY,
                    message=str(e)
                )
            
            results.append(response)
            self._health_cache[p] = response
        
        # Cache for 5 minutes
        self._health_cache_expiry = current_time + timedelta(minutes=5)
        
        # Determine overall status
        if all(r.status == GSPHealthStatus.HEALTHY for r in results):
            overall = GSPHealthStatus.HEALTHY
        elif any(r.status == GSPHealthStatus.UNHEALTHY for r in results):
            overall = GSPHealthStatus.UNHEALTHY
        else:
            overall = GSPHealthStatus.DEGRADED
        
        return GSPHealthCheckResult(
            overall_status=overall,
            providers=results,
            default_provider=self._default_provider,
            last_checked=current_time
        )
    
    def get_auth_status(
        self,
        gstin: str,
        provider: Optional[GSPProvider] = None
    ) -> Dict[str, Any]:
        """
        Get authentication status for a GSTIN.
        
        Args:
            gstin: GSTIN to check
            provider: Provider to check (uses default if not specified)
            
        Returns:
            Dictionary with auth status
        """
        gsp = self.get_provider(provider)
        status = gsp.get_auth_status(gstin)
        
        return {
            "gstin": gstin,
            "provider": gsp.provider,
            "status": status.value if hasattr(status, 'value') else status,
            "is_authenticated": status == AuthStatus.AUTHENTICATED
        }
    
    def failover(
        self,
        failed_provider: GSPProvider,
        operation: str
    ) -> Optional[GSPBase]:
        """
        Attempt to failover to another provider.
        
        Args:
            failed_provider: The provider that failed
            operation: The operation being attempted
            
        Returns:
            New provider instance or None
        """
        # Try all other configured providers
        for provider in self._configs.keys():
            if provider == failed_provider:
                continue
            
            try:
                instance = self.get_provider(provider)
                # Quick health check
                health = instance.health_check()
                if health.get("status") == GSPHealthStatus.HEALTHY:
                    logger.info(f"Failover from {failed_provider.value} to {provider.value}")
                    return instance
            except Exception as e:
                logger.warning(f"Provider {provider.value} not available for failover: {e}")
        
        return None


# Global registry instance
_gsp_registry: Optional[GSPRegistry] = None


def get_gsp_registry() -> GSPRegistry:
    """Get the global GSP registry instance."""
    global _gsp_registry
    if _gsp_registry is None:
        _gsp_registry = GSPRegistry()
    return _gsp_registry


def register_gsp(
    provider: GSPProvider,
    provider_class: Type[GSPBase],
    config: Optional[GSPConfig] = None
) -> None:
    """Register a GSP provider."""
    registry = get_gsp_registry()
    registry.register_provider(provider, provider_class, config)


def get_gsp_provider(provider: Optional[GSPProvider] = None) -> GSPBase:
    """Get a GSP provider instance."""
    registry = get_gsp_registry()
    return registry.get_provider(provider)


def configure_gsp(config: GSPConfig) -> None:
    """Configure a GSP provider."""
    registry = get_gsp_registry()
    registry.configure_provider(config)


def list_gsp_providers() -> List[GSPProviderInfo]:
    """List all registered GSP providers."""
    registry = get_gsp_registry()
    return registry.list_providers()


def gsp_health_check(
    provider: Optional[GSPProvider] = None,
    force_refresh: bool = False
) -> GSPHealthCheckResult:
    """Perform GSP health check."""
    registry = get_gsp_registry()
    return registry.health_check(provider, force_refresh)
