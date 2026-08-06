package lab.rbac;

import org.springframework.security.access.prepost.PreAuthorize;

/**
 * Lab fixture — authorization-enforcing service layer with NO HTTP surface
 * (Fineract DatatableWriteService-shaped). Platform should emit a service
 * unit from @PreAuthorize alone and attach RBAC control evidence.
 */
public interface DatatableWriteService {

    @PreAuthorize("hasPermission(#datatableName, 'CREATE')")
    void createDatatable(String datatableName);

    @PreAuthorize("hasPermission(#datatableName, 'UPDATE')")
    void updateDatatable(String datatableName);

    @PreAuthorize("hasPermission(#datatableName, 'DELETE')")
    void deleteDatatable(String datatableName);
}
