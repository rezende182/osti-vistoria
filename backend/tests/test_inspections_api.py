"""
Backend API Tests for OSTI Engenharia - Vistoria de Imóvel
CRUD exige Firebase ID token: defina API_TEST_FIREBASE_TOKEN (Bearer) no ambiente.
"""
import os
import uuid
from datetime import datetime

import pytest
import requests

BASE_URL = os.environ.get(
    "REACT_APP_BACKEND_URL", "https://vistoria-imovel-1.preview.emergentagent.com"
)


@pytest.fixture
def api_client():
    """Sessão sem autenticação (health, testes 401)."""
    session = requests.Session()
    session.headers.update({"Content-Type": "application/json"})
    return session


@pytest.fixture
def auth_session():
    """Sessão com Authorization: Bearer <Firebase ID token>."""
    token = os.environ.get("API_TEST_FIREBASE_TOKEN", "").strip()
    if not token:
        pytest.skip(
            "Defina API_TEST_FIREBASE_TOKEN com um ID token Firebase válido para testes CRUD."
        )
    session = requests.Session()
    session.headers.update(
        {
            "Content-Type": "application/json",
            "Authorization": f"Bearer {token}",
        }
    )
    return session


@pytest.fixture
def test_inspection_data():
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
        "documentos_recebidos": ["Manual do proprietário", "Chaves da unidade"],
    }


class TestHealthCheck:
    def test_api_root(self, api_client):
        response = api_client.get(f"{BASE_URL}/api/")
        assert response.status_code == 200
        data = response.json()
        assert "message" in data
        assert "OSTI Engenharia" in data["message"]
        print("✓ API root endpoint working")


class TestAuthRequired:
    """Rotas /inspections e /users/register exigem Bearer token."""

    def test_inspections_list_without_token_returns_401(self, api_client):
        r = api_client.get(f"{BASE_URL}/api/inspections")
        assert r.status_code == 401

    def test_inspections_create_without_token_returns_401(self, api_client, test_inspection_data):
        r = api_client.post(f"{BASE_URL}/api/inspections", json=test_inspection_data)
        assert r.status_code == 401


class TestInspectionsCRUD:
    def test_create_inspection(self, auth_session, test_inspection_data):
        response = auth_session.post(f"{BASE_URL}/api/inspections", json=test_inspection_data)
        assert response.status_code == 200
        data = response.json()
        assert "id" in data
        assert data["cliente"] == test_inspection_data["cliente"]
        assert data.get("userId")
        assert data["status"] == "em_andamento"
        auth_session.delete(f"{BASE_URL}/api/inspections/{data['id']}")

    def test_get_all_inspections(self, auth_session):
        response = auth_session.get(f"{BASE_URL}/api/inspections")
        assert response.status_code == 200
        assert isinstance(response.json(), list)

    def test_get_single_inspection(self, auth_session, test_inspection_data):
        create_response = auth_session.post(
            f"{BASE_URL}/api/inspections", json=test_inspection_data
        )
        inspection_id = create_response.json()["id"]
        response = auth_session.get(f"{BASE_URL}/api/inspections/{inspection_id}")
        assert response.status_code == 200
        assert response.json()["id"] == inspection_id
        auth_session.delete(f"{BASE_URL}/api/inspections/{inspection_id}")

    def test_get_nonexistent_inspection(self, auth_session):
        fake_id = str(uuid.uuid4())
        response = auth_session.get(f"{BASE_URL}/api/inspections/{fake_id}")
        assert response.status_code == 404

    def test_update_inspection_checklist(self, auth_session, test_inspection_data):
        create_response = auth_session.post(
            f"{BASE_URL}/api/inspections", json=test_inspection_data
        )
        inspection_id = create_response.json()["id"]
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
                            "photos": [],
                        },
                        {
                            "name": "Paredes",
                            "exists": "sim",
                            "condition": "aprovado",
                            "observations": "",
                            "photos": [],
                        },
                    ],
                }
            ]
        }
        response = auth_session.put(
            f"{BASE_URL}/api/inspections/{inspection_id}", json=update_data
        )
        assert response.status_code == 200
        get_response = auth_session.get(f"{BASE_URL}/api/inspections/{inspection_id}")
        assert len(get_response.json()["rooms_checklist"]) == 1
        auth_session.delete(f"{BASE_URL}/api/inspections/{inspection_id}")

    def test_finalize_inspection(self, auth_session, test_inspection_data):
        create_response = auth_session.post(
            f"{BASE_URL}/api/inspections", json=test_inspection_data
        )
        inspection_id = create_response.json()["id"]
        update_data = {
            "classificacao_final": "aprovado",
            "conclusao": "Imóvel em boas condições",
            "assinatura": "data:image/png;base64,iVBORw0KGgo=",
            "responsavel_final": "Eng. Responsável",
            "data_final": datetime.now().strftime("%Y-%m-%d"),
        }
        response = auth_session.put(
            f"{BASE_URL}/api/inspections/{inspection_id}", json=update_data
        )
        assert response.status_code == 200
        assert response.json()["status"] == "concluida"
        auth_session.delete(f"{BASE_URL}/api/inspections/{inspection_id}")

    def test_update_identification(self, auth_session, test_inspection_data):
        create_response = auth_session.post(
            f"{BASE_URL}/api/inspections", json=test_inspection_data
        )
        inspection_id = create_response.json()["id"]
        update_data = {
            "cliente": "TEST_Cliente_Atualizado",
            "endereco": "TEST_Novo Endereço 123",
        }
        response = auth_session.put(
            f"{BASE_URL}/api/inspections/{inspection_id}/identification",
            json=update_data,
        )
        assert response.status_code == 200
        auth_session.delete(f"{BASE_URL}/api/inspections/{inspection_id}")

    def test_delete_inspection(self, auth_session, test_inspection_data):
        create_response = auth_session.post(
            f"{BASE_URL}/api/inspections", json=test_inspection_data
        )
        inspection_id = create_response.json()["id"]
        response = auth_session.delete(f"{BASE_URL}/api/inspections/{inspection_id}")
        assert response.status_code == 200
        get_response = auth_session.get(f"{BASE_URL}/api/inspections/{inspection_id}")
        assert get_response.status_code == 404


class TestInspectionValidation:
    def test_create_with_all_classification_types(self, auth_session, test_inspection_data):
        classifications = ["aprovado", "aprovado_com_ressalvas", "reprovado", "outro"]
        for classificacao in classifications:
            response = auth_session.post(
                f"{BASE_URL}/api/inspections", json=test_inspection_data
            )
            inspection_id = response.json()["id"]
            update_response = auth_session.put(
                f"{BASE_URL}/api/inspections/{inspection_id}",
                json={
                    "classificacao_final": classificacao,
                    "assinatura": "data:image/png;base64,test",
                },
            )
            assert update_response.status_code == 200
            auth_session.delete(f"{BASE_URL}/api/inspections/{inspection_id}")

    def test_tipo_imovel_options(self, auth_session):
        for tipo in ["novo", "usado", "reformado"]:
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
                "documentos_recebidos": [],
            }
            response = auth_session.post(f"{BASE_URL}/api/inspections", json=data)
            assert response.status_code == 200
            iid = response.json()["id"]
            auth_session.delete(f"{BASE_URL}/api/inspections/{iid}")


class TestExistingInspection:
    def test_get_existing_inspection(self, auth_session):
        existing_id = "0e0539e2-9f73-49f7-90bd-cc5060ac5bac"
        response = auth_session.get(f"{BASE_URL}/api/inspections/{existing_id}")
        if response.status_code != 200:
            pytest.skip("Existing inspection not available for this token")
        print(f"✓ Found inspection: {response.json().get('cliente')}")


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
