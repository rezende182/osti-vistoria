"""
Backend API Tests for OSTI Engenharia - Vistoria de Imóvel
Tests CRUD operations for inspections endpoint
"""
import pytest
import requests
import os
import uuid
from datetime import datetime

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://vistoria-imovel-1.preview.emergentagent.com')

@pytest.fixture
def api_client():
    """Shared requests session"""
    session = requests.Session()
    session.headers.update({"Content-Type": "application/json"})
    return session

@pytest.fixture
def test_inspection_data():
    """Generate unique test inspection data"""
    unique_id = str(uuid.uuid4())[:8]
    return {
        "cliente": f"TEST_Cliente_{unique_id}",
        "data": datetime.now().strftime("%Y-%m-%d"),
        "endereco": f"TEST_Endereço {unique_id}",
        "unidade": f"Apto {unique_id}",
        "empreendimento": "TEST_Empreendimento",
        "construtora": "TEST_Construtora",
        "responsavel_tecnico": "Eng. Teste",
        "crea": "CREA-123456",
        "horario_inicio": "09:00",
        "horario_termino": "12:00",
        "tipo_imovel": "novo",
        "energia_disponivel": "sim",
        "documentos_recebidos": ["Manual do proprietário", "Chaves da unidade"]
    }


class TestHealthCheck:
    """Test API health and root endpoint"""
    
    def test_api_root(self, api_client):
        """Test root endpoint returns correct message"""
        response = api_client.get(f"{BASE_URL}/api/")
        assert response.status_code == 200
        data = response.json()
        assert "message" in data
        assert "OSTI Engenharia" in data["message"]
        print("✓ API root endpoint working")


class TestInspectionsCRUD:
    """Test CRUD operations for inspections"""
    
    def test_create_inspection(self, api_client, test_inspection_data):
        """Test creating a new inspection"""
        response = api_client.post(f"{BASE_URL}/api/inspections", json=test_inspection_data)
        assert response.status_code == 200
        
        data = response.json()
        assert "id" in data
        assert data["cliente"] == test_inspection_data["cliente"]
        assert data["endereco"] == test_inspection_data["endereco"]
        assert data["unidade"] == test_inspection_data["unidade"]
        assert data["status"] == "em_andamento"
        print(f"✓ Created inspection with ID: {data['id']}")
        
        # Clean up
        api_client.delete(f"{BASE_URL}/api/inspections/{data['id']}")
    
    def test_get_all_inspections(self, api_client):
        """Test getting all inspections"""
        response = api_client.get(f"{BASE_URL}/api/inspections")
        assert response.status_code == 200
        
        data = response.json()
        assert isinstance(data, list)
        print(f"✓ Got {len(data)} inspections")
    
    def test_get_single_inspection(self, api_client, test_inspection_data):
        """Test getting a single inspection by ID"""
        # Create first
        create_response = api_client.post(f"{BASE_URL}/api/inspections", json=test_inspection_data)
        inspection_id = create_response.json()["id"]
        
        # Get by ID
        response = api_client.get(f"{BASE_URL}/api/inspections/{inspection_id}")
        assert response.status_code == 200
        
        data = response.json()
        assert data["id"] == inspection_id
        assert data["cliente"] == test_inspection_data["cliente"]
        print(f"✓ Got inspection {inspection_id}")
        
        # Clean up
        api_client.delete(f"{BASE_URL}/api/inspections/{inspection_id}")
    
    def test_get_nonexistent_inspection(self, api_client):
        """Test getting a non-existent inspection returns 404"""
        fake_id = str(uuid.uuid4())
        response = api_client.get(f"{BASE_URL}/api/inspections/{fake_id}")
        assert response.status_code == 404
        print("✓ Non-existent inspection returns 404")
    
    def test_update_inspection_checklist(self, api_client, test_inspection_data):
        """Test updating inspection with rooms checklist"""
        # Create first
        create_response = api_client.post(f"{BASE_URL}/api/inspections", json=test_inspection_data)
        inspection_id = create_response.json()["id"]
        
        # Update with checklist
        update_data = {
            "rooms_checklist": [
                {
                    "room_id": "sala",
                    "room_name": "Sala",
                    "room_type": "sala",
                    "items": [
                        {
                            "name": "Teto",
                            "exists": "sim",
                            "condition": "aprovado",
                            "observations": "Sem manchas",
                            "photos": []
                        },
                        {
                            "name": "Paredes",
                            "exists": "sim",
                            "condition": "aprovado",
                            "observations": "",
                            "photos": []
                        }
                    ]
                }
            ]
        }
        
        response = api_client.put(f"{BASE_URL}/api/inspections/{inspection_id}", json=update_data)
        assert response.status_code == 200
        
        data = response.json()
        assert len(data["rooms_checklist"]) == 1
        assert data["rooms_checklist"][0]["room_name"] == "Sala"
        print(f"✓ Updated inspection checklist")
        
        # Verify persistence with GET
        get_response = api_client.get(f"{BASE_URL}/api/inspections/{inspection_id}")
        assert get_response.status_code == 200
        persisted_data = get_response.json()
        assert len(persisted_data["rooms_checklist"]) == 1
        print("✓ Checklist update persisted correctly")
        
        # Clean up
        api_client.delete(f"{BASE_URL}/api/inspections/{inspection_id}")
    
    def test_finalize_inspection(self, api_client, test_inspection_data):
        """Test finalizing inspection with classification"""
        # Create first
        create_response = api_client.post(f"{BASE_URL}/api/inspections", json=test_inspection_data)
        inspection_id = create_response.json()["id"]
        
        # Finalize
        update_data = {
            "classificacao_final": "aprovado",
            "conclusao": "Imóvel em boas condições",
            "assinatura": "data:image/png;base64,iVBORw0KGgo=",
            "responsavel_final": "Eng. Responsável",
            "data_final": datetime.now().strftime("%Y-%m-%d")
        }
        
        response = api_client.put(f"{BASE_URL}/api/inspections/{inspection_id}", json=update_data)
        assert response.status_code == 200
        
        data = response.json()
        assert data["classificacao_final"] == "aprovado"
        assert data["status"] == "concluida"
        print(f"✓ Finalized inspection with status: {data['status']}")
        
        # Clean up
        api_client.delete(f"{BASE_URL}/api/inspections/{inspection_id}")
    
    def test_update_identification(self, api_client, test_inspection_data):
        """Test updating inspection identification info"""
        # Create first
        create_response = api_client.post(f"{BASE_URL}/api/inspections", json=test_inspection_data)
        inspection_id = create_response.json()["id"]
        
        # Update identification
        update_data = {
            "cliente": "TEST_Cliente_Atualizado",
            "endereco": "TEST_Novo Endereço 123"
        }
        
        response = api_client.put(f"{BASE_URL}/api/inspections/{inspection_id}/identification", json=update_data)
        assert response.status_code == 200
        
        data = response.json()
        assert data["cliente"] == "TEST_Cliente_Atualizado"
        assert data["endereco"] == "TEST_Novo Endereço 123"
        print("✓ Updated identification info")
        
        # Verify persistence
        get_response = api_client.get(f"{BASE_URL}/api/inspections/{inspection_id}")
        persisted = get_response.json()
        assert persisted["cliente"] == "TEST_Cliente_Atualizado"
        print("✓ Identification update persisted")
        
        # Clean up
        api_client.delete(f"{BASE_URL}/api/inspections/{inspection_id}")
    
    def test_delete_inspection(self, api_client, test_inspection_data):
        """Test deleting an inspection"""
        # Create first
        create_response = api_client.post(f"{BASE_URL}/api/inspections", json=test_inspection_data)
        inspection_id = create_response.json()["id"]
        
        # Delete
        response = api_client.delete(f"{BASE_URL}/api/inspections/{inspection_id}")
        assert response.status_code == 200
        
        # Verify deletion
        get_response = api_client.get(f"{BASE_URL}/api/inspections/{inspection_id}")
        assert get_response.status_code == 404
        print(f"✓ Deleted inspection {inspection_id}")


class TestInspectionValidation:
    """Test validation and edge cases"""
    
    def test_create_with_all_classification_types(self, api_client, test_inspection_data):
        """Test creating inspections with different classification types"""
        classifications = ["aprovado", "aprovado_com_ressalvas", "reprovado", "outro"]
        
        for classificacao in classifications:
            # Create
            response = api_client.post(f"{BASE_URL}/api/inspections", json=test_inspection_data)
            inspection_id = response.json()["id"]
            
            # Finalize with classification
            update_response = api_client.put(
                f"{BASE_URL}/api/inspections/{inspection_id}",
                json={"classificacao_final": classificacao, "assinatura": "data:image/png;base64,test"}
            )
            assert update_response.status_code == 200
            data = update_response.json()
            assert data["classificacao_final"] == classificacao
            assert data["status"] == "concluida"
            
            # Clean up
            api_client.delete(f"{BASE_URL}/api/inspections/{inspection_id}")
            print(f"✓ Classification '{classificacao}' works correctly")
    
    def test_tipo_imovel_options(self, api_client):
        """Test all property types are accepted"""
        tipos = ["novo", "usado", "reformado"]
        
        for tipo in tipos:
            data = {
                "cliente": f"TEST_Cliente_{tipo}",
                "data": "2025-01-15",
                "endereco": "Test Address",
                "unidade": "101",
                "empreendimento": "Test",
                "construtora": "Test",
                "responsavel_tecnico": "Test",
                "crea": "123",
                "horario_inicio": "09:00",
                "horario_termino": "12:00",
                "tipo_imovel": tipo,
                "energia_disponivel": "sim",
                "documentos_recebidos": []
            }
            
            response = api_client.post(f"{BASE_URL}/api/inspections", json=data)
            assert response.status_code == 200
            assert response.json()["tipo_imovel"] == tipo
            
            # Clean up
            api_client.delete(f"{BASE_URL}/api/inspections/{response.json()['id']}")
            print(f"✓ Property type '{tipo}' accepted")


class TestExistingInspection:
    """Test with existing inspection from previous testing"""
    
    def test_get_existing_inspection(self, api_client):
        """Test getting the inspection created in previous tests"""
        # ID from agent context
        existing_id = "0e0539e2-9f73-49f7-90bd-cc5060ac5bac"
        
        response = api_client.get(f"{BASE_URL}/api/inspections/{existing_id}")
        
        if response.status_code == 200:
            data = response.json()
            print(f"✓ Found existing inspection: {data['cliente']}")
            print(f"  Status: {data['status']}")
            print(f"  Classification: {data.get('classificacao_final', 'N/A')}")
        else:
            print(f"! Existing inspection {existing_id} not found (may have been deleted)")
            pytest.skip("Existing inspection not available")


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
